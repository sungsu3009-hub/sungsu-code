// 서버(API)와 연결되는 기능: 실시간 정보, 소식, 예약, 예약조회
(function () {
  // 파일을 더블클릭해서 열었을 때(file://)는 서버가 없으므로 기존 화면 그대로 둔다
  const hasServer = location.protocol.startsWith("http");

  async function request(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
    return data;
  }

  const $ = (id) => document.getElementById(id);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function todayKST() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  }

  function addDays(dateStr, days) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function formatDate(dateStr) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    const week = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
    return `${dateStr.replace(/-/g, ".")} (${week})`;
  }

  // =========================================================
  // 오늘의 이포CC
  // =========================================================
  async function loadToday() {
    const data = await request("/today");

    if (data.weather) {
      $("headerTemp").textContent = `${data.weather.temp}°`;
      $("todayWeather").textContent = `${data.weather.sky} ${data.weather.temp}°`;
      $("todayRain").textContent =
        data.weather.rainChance == null ? "강수확률 정보 없음" : `강수확률 ${data.weather.rainChance}%`;
    }

    $("todayStatus").textContent = data.course.status;
    $("todayGreen").textContent = data.course.note;

    const s = data.slots;
    const prefix = s.day === "tomorrow" ? "내일 " : "";
    if (s.count === 0) {
      $("todaySlots").textContent = "예약 마감";
      $("todaySlotsNote").textContent = `(${prefix}${s.course} 기준)`;
    } else {
      $("todaySlots").textContent = `${s.first} - ${s.last}`;
      $("todaySlotsNote").textContent = `(${prefix}${s.course} · 잔여 ${s.count}팀)`;
    }
  }

  // =========================================================
  // 소식
  // =========================================================
  async function loadNews() {
    const list = await request("/news");
    if (!list.length) return;

    const wrap = $("newsList");
    wrap.replaceChildren(
      ...list.map((item) => {
        const card = el("a", "news-card");
        card.href = "#";

        const img = el("div", "news-card__img img");
        // 이미지 경로는 images/ 폴더 안의 파일만 허용
        if (/^images\/[\w.-]+$/.test(item.image)) {
          img.style.backgroundImage = `url('${item.image}'), var(--ph)`;
        }
        img.append(el("span", item.type === "NEWS" ? "tag tag--navy" : "tag", item.type));

        const body = el("div", "news-card__body");
        const meta = el("div", "news-card__meta");
        meta.append(el("time", null, item.period), el("i", "arr arr--dark"));
        body.append(el("strong", null, item.title), meta);

        card.append(img, body);
        return card;
      })
    );
  }

  // =========================================================
  // 모달 열기/닫기
  // =========================================================
  let lastFocus = null;

  function openModal(id) {
    const modal = $(id);
    lastFocus = document.activeElement;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
    document.body.style.overflow = "hidden";
    modal.querySelector("input, select, button")?.focus();
    if (id === "reserveModal") resetReserve();
    if (id === "lookupModal") resetLookup();
  }

  function closeModal(modal) {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
    setTimeout(() => (modal.hidden = true), 250);
    lastFocus?.focus();
  }

  document.querySelectorAll("[data-modal]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      if (!hasServer) return; // 서버 없이 열었을 때는 기존 링크 동작
      e.preventDefault();
      openModal(btn.dataset.modal);
    })
  );

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.closest("[data-close]")) closeModal(modal);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = document.querySelector(".modal.is-open");
    if (open) closeModal(open);
  });

  // =========================================================
  // 예약하기
  // =========================================================
  const reserveForm = $("reserveForm");
  const dateInput = $("reserveDate");
  const courseInput = $("reserveCourse");
  const slotList = $("slotList");
  let selectedTime = null;

  function resetReserve() {
    const today = todayKST();
    dateInput.min = today;
    dateInput.max = addDays(today, 30);
    if (!dateInput.value || dateInput.value < today) dateInput.value = addDays(today, 1);
    reserveForm.hidden = false;
    $("reserveResult").hidden = true;
    $("reserveMsg").textContent = "";
    loadSlots();
  }

  async function loadSlots() {
    selectedTime = null;
    slotList.replaceChildren(el("p", "slots__empty", "티타임을 불러오는 중..."));
    try {
      const slots = await request(`/slots?date=${dateInput.value}&course=${courseInput.value}`);
      if (!slots.some((s) => s.available)) {
        slotList.replaceChildren(el("p", "slots__empty", "선택한 날짜에 예약 가능한 시간이 없습니다."));
        return;
      }
      slotList.replaceChildren(
        ...slots.map((s) => {
          const b = el("button", "slot", s.time);
          b.type = "button";
          b.disabled = !s.available;
          b.setAttribute("role", "radio");
          b.setAttribute("aria-checked", "false");
          b.addEventListener("click", () => {
            slotList.querySelectorAll(".slot").forEach((x) => x.setAttribute("aria-checked", "false"));
            b.setAttribute("aria-checked", "true");
            selectedTime = s.time;
          });
          return b;
        })
      );
    } catch (err) {
      slotList.replaceChildren(el("p", "slots__empty", err.message));
    }
  }

  dateInput.addEventListener("change", loadSlots);
  courseInput.addEventListener("change", loadSlots);

  reserveForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("reserveMsg");
    const form = new FormData(reserveForm);
    if (!selectedTime) {
      msg.textContent = "티타임을 선택해주세요.";
      return;
    }

    const submit = reserveForm.querySelector("[type=submit]");
    submit.disabled = true;
    msg.textContent = "";
    try {
      const r = await request("/reservations", {
        method: "POST",
        body: {
          date: form.get("date"),
          course: form.get("course"),
          time: selectedTime,
          name: form.get("name"),
          phone: form.get("phone"),
          players: Number(form.get("players")),
        },
      });
      reserveForm.hidden = true;
      showResult($("reserveResult"), r, "예약이 완료되었습니다");
      loadToday().catch(() => {});
    } catch (err) {
      msg.textContent = err.message;
      loadSlots(); // 다른 사람이 먼저 예약했을 수 있으니 시간표 새로고침
    } finally {
      submit.disabled = false;
    }
  });

  // =========================================================
  // 예약조회 / 취소
  // =========================================================
  const lookupForm = $("lookupForm");

  function resetLookup() {
    lookupForm.hidden = false;
    $("lookupResult").hidden = true;
    $("lookupMsg").textContent = "";
  }

  lookupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("lookupMsg");
    const form = new FormData(lookupForm);
    msg.textContent = "";
    try {
      const r = await request("/reservations/lookup", {
        method: "POST",
        body: { phone: form.get("phone"), code: form.get("code") },
      });
      lookupForm.hidden = true;
      showResult($("lookupResult"), r, r.status === "canceled" ? "취소된 예약입니다" : "예약 내역", form.get("phone"));
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  // 예약 결과 카드 (예약 완료 / 조회 결과 공용)
  function showResult(box, r, heading, phoneForCancel) {
    const rows = [
      ["예약번호", r.code],
      ["날짜", formatDate(r.date)],
      ["코스 · 시간", `${r.courseName} ${r.time}`],
      ["예약자", `${r.name} (${r.phone})`],
      ["인원", `${r.players}명`],
    ];

    const dl = el("dl", "result__list");
    rows.forEach(([k, v]) => dl.append(el("dt", null, k), el("dd", null, v)));

    const children = [el("h3", "result__title", heading), dl];

    if (!phoneForCancel) {
      children.push(el("p", "result__note", "예약번호는 조회·취소 시 필요하니 꼭 저장해주세요."));
    } else if (r.status === "confirmed") {
      const cancel = el("button", "btn btn--line btn--sm", "예약 취소");
      cancel.type = "button";
      cancel.addEventListener("click", async () => {
        if (!confirm("예약을 취소하시겠습니까?")) return;
        try {
          const updated = await request(`/reservations/${r.code}/cancel`, {
            method: "POST",
            body: { phone: phoneForCancel },
          });
          showResult(box, updated, "예약이 취소되었습니다", phoneForCancel);
          loadToday().catch(() => {});
        } catch (err) {
          alert(err.message);
        }
      });
      children.push(cancel);
    }

    box.classList.toggle("is-canceled", r.status === "canceled");
    box.replaceChildren(...children);
    box.hidden = false;
  }

  // =========================================================
  // 시작
  // =========================================================
  if (hasServer) {
    loadToday().catch((err) => console.warn("오늘의 정보:", err.message));
    loadNews().catch((err) => console.warn("소식:", err.message));
  }
})();
