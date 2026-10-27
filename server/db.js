// SQLite 데이터베이스 (Node 22.13+ 내장 node:sqlite 사용 — 별도 설치 불필요)
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.DB_PATH || resolve(root, "data", "ipocc.db");
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS reservations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,
    date        TEXT    NOT NULL,             -- YYYY-MM-DD
    course      TEXT    NOT NULL,             -- east | west
    time        TEXT    NOT NULL,             -- HH:MM
    name        TEXT    NOT NULL,
    phone       TEXT    NOT NULL,             -- 숫자만 저장 (01012345678)
    players     INTEGER NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'confirmed',  -- confirmed | canceled
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- 같은 날짜·코스·시간에는 확정 예약이 하나만 존재 (취소된 예약은 제외)
  CREATE UNIQUE INDEX IF NOT EXISTS uq_slot
    ON reservations (date, course, time) WHERE status = 'confirmed';

  CREATE TABLE IF NOT EXISTS news (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL,                -- EVENT | NEWS
    title       TEXT NOT NULL,
    period      TEXT NOT NULL,                -- 화면에 보이는 날짜/기간 문구
    image       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// 최초 실행 시 기본 데이터 넣기
if (db.prepare("SELECT COUNT(*) AS n FROM news").get().n === 0) {
  const insert = db.prepare("INSERT INTO news (type, title, period, image) VALUES (?, ?, ?, ?)");
  insert.run("EVENT", "프로샵 신상품 입고 안내", "2025.03.01", "images/news-3.png");
  insert.run("NEWS", "이포CC 클럽하우스 리뉴얼 오픈", "2025.03.20", "images/news-2.png");
  insert.run("EVENT", "명절 선물세트 특별 판매", "2025.04.01 - 2025.05.31", "images/news-1.png");
}

const defaults = { course_status: "양호", green_note: "그린 빠름" };
const setDefault = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
for (const [k, v] of Object.entries(defaults)) setDefault.run(k, v);

export function getSetting(key) {
  return db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value ?? null;
}
