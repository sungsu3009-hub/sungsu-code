// 티타임 / 날짜 관련 공통 함수
export const COURSES = { east: "동코스", west: "서코스" };
export const BOOKING_DAYS = 30; // 오늘부터 며칠 뒤까지 예약 가능

// 06:00 ~ 14:50, 10분 간격
export const TEE_TIMES = [];
for (let m = 6 * 60; m <= 14 * 60 + 50; m += 10) {
  TEE_TIMES.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
}

// 서버가 어느 나라에 있든 한국 시간 기준으로 계산
export function nowKST() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateStr;
}

// 예약 가능한 날짜 범위인지 (오늘 ~ 오늘+30일)
export function isBookableDate(dateStr) {
  const today = nowKST().date;
  return isValidDate(dateStr) && dateStr >= today && dateStr <= addDays(today, BOOKING_DAYS);
}

// 오늘이면 이미 지난 시간은 제외
export function isPastTime(dateStr, time) {
  const now = nowKST();
  return dateStr === now.date && time <= now.time;
}
