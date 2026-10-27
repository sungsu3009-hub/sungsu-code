// API 라우터 — 프론트엔드(js/app.js)가 호출하는 주소들
import { Router } from "express";
import { randomInt } from "node:crypto";
import { db, getSetting } from "./db.js";
import { getWeather } from "./weather.js";
import {
  COURSES, TEE_TIMES, BOOKING_DAYS,
  nowKST, addDays, isBookableDate, isPastTime,
} from "./teetimes.js";

export const api = Router();

// ---------- 공통 ----------
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/O, 1/I 제외

function makeCode() {
  let code = "";
  for (let i = 0; i < 8; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return code;
}

function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return /^01\d{8,9}$/.test(digits) ? digits : null;
}

function maskPhone(digits) {
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function bookedTimes(date, course) {
  return new Set(
    db.prepare("SELECT time FROM reservations WHERE date = ? AND course = ? AND status = 'confirmed'")
      .all(date, course)
      .map((r) => r.time)
  );
}

function openTimes(date, course) {
  const booked = bookedTimes(date, course);
  return TEE_TIMES.filter((t) => !booked.has(t) && !isPastTime(date, t));
}

function toPublic(r) {
  return {
    code: r.code,
    date: r.date,
    course: r.course,
    courseName: COURSES[r.course],
    time: r.time,
    name: r.name,
    phone: maskPhone(r.phone),
    players: r.players,
    status: r.status,
  };
}

// 같은 IP에서 너무 많이 요청하면 잠시 차단 (예약번호 무작위 대입 방지)
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const entry = hits.get(req.ip);
    if (!entry || now - entry.start > windowMs) {
      if (hits.size > 10_000) hits.clear(); // 메모리가 계속 늘지 않도록
      hits.set(req.ip, { start: now, count: 1 });
      return next();
    }
    if (++entry.count > max) {
      return res.status(429).json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." });
    }
    next();
  };
}
const writeLimit = rateLimit({ windowMs: 60_000, max: 20 });

// ---------- 오늘의 이포CC ----------
// GET /api/today
api.get("/today", async (req, res) => {
  const today = nowKST().date;

  // 오늘 남은 티타임이 없으면 내일 기준으로 안내
  let day = "today";
  let times = openTimes(today, "east");
  if (times.length === 0) {
    day = "tomorrow";
    times = openTimes(addDays(today, 1), "east");
  }

  res.json({
    weather: await getWeather(),
    course: { status: getSetting("course_status"), note: getSetting("green_note") },
    slots: {
      day,
      course: COURSES.east,
      first: times[0] ?? null,
      last: times.at(-1) ?? null,
      count: times.length,
    },
  });
});

// ---------- 소식 ----------
// GET /api/news
api.get("/news", (req, res) => {
  const rows = db.prepare("SELECT id, type, title, period, image FROM news ORDER BY id DESC LIMIT 3").all();
  res.json(rows);
});

// ---------- 티타임 조회 ----------
// GET /api/slots?date=2026-11-01&course=east
api.get("/slots", (req, res) => {
  const { date, course } = req.query;
  if (!COURSES[course]) return res.status(400).json({ error: "코스를 선택해주세요." });
  if (!isBookableDate(date)) {
    return res.status(400).json({ error: `오늘부터 ${BOOKING_DAYS}일 이내 날짜만 예약할 수 있습니다.` });
  }

  const booked = bookedTimes(date, course);
  res.json(
    TEE_TIMES.map((time) => ({
      time,
      available: !booked.has(time) && !isPastTime(date, time),
    }))
  );
});

// ---------- 예약 ----------
// POST /api/reservations  { date, course, time, name, phone, players }
api.post("/reservations", writeLimit, (req, res) => {
  const { date, course, time } = req.body ?? {};
  const name = String(req.body?.name ?? "").trim();
  const phone = normalizePhone(req.body?.phone);
  const players = Number(req.body?.players);

  if (!isBookableDate(date)) return res.status(400).json({ error: "예약 가능한 날짜가 아닙니다." });
  if (!COURSES[course]) return res.status(400).json({ error: "코스를 선택해주세요." });
  if (!TEE_TIMES.includes(time) || isPastTime(date, time)) {
    return res.status(400).json({ error: "티타임을 선택해주세요." });
  }
  if (name.length < 2 || name.length > 20) return res.status(400).json({ error: "예약자명을 2~20자로 입력해주세요." });
  if (!phone) return res.status(400).json({ error: "연락처를 정확히 입력해주세요. (예: 010-1234-5678)" });
  if (![2, 3, 4].includes(players)) return res.status(400).json({ error: "인원은 2~4명입니다." });

  const insert = db.prepare(
    "INSERT INTO reservations (code, date, course, time, name, phone, players) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  // 예약번호가 우연히 겹치면 다시 생성
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    try {
      insert.run(code, date, course, time, name, phone, players);
      const row = db.prepare("SELECT * FROM reservations WHERE code = ?").get(code);
      return res.status(201).json(toPublic(row));
    } catch (err) {
      if (!String(err.message).includes("UNIQUE")) throw err;
      if (err.message.includes("reservations.code")) continue;
      // 같은 시간대를 다른 사람이 먼저 예약한 경우
      return res.status(409).json({ error: "방금 다른 고객이 예약한 시간입니다. 다른 시간을 선택해주세요." });
    }
  }
  res.status(500).json({ error: "예약번호 생성에 실패했습니다. 다시 시도해주세요." });
});

// POST /api/reservations/lookup  { phone, code }
// 연락처가 주소(URL)에 남지 않도록 GET 대신 POST 사용
api.post("/reservations/lookup", writeLimit, (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  const row = phone && db.prepare("SELECT * FROM reservations WHERE code = ? AND phone = ?").get(code, phone);
  if (!row) return res.status(404).json({ error: "일치하는 예약이 없습니다. 연락처와 예약번호를 확인해주세요." });
  res.json(toPublic(row));
});

// POST /api/reservations/:code/cancel  { phone }
api.post("/reservations/:code/cancel", writeLimit, (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code = String(req.params.code).toUpperCase();
  const row = phone && db.prepare("SELECT * FROM reservations WHERE code = ? AND phone = ?").get(code, phone);
  if (!row) return res.status(404).json({ error: "일치하는 예약이 없습니다." });
  if (row.status === "canceled") return res.status(400).json({ error: "이미 취소된 예약입니다." });
  if (row.date < nowKST().date || isPastTime(row.date, row.time)) {
    return res.status(400).json({ error: "지난 예약은 취소할 수 없습니다." });
  }

  db.prepare("UPDATE reservations SET status = 'canceled' WHERE id = ?").run(row.id);
  res.json(toPublic({ ...row, status: "canceled" }));
});
