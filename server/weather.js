// 실시간 날씨 (Open-Meteo — 무료, API 키 불필요)
// 좌표: 경기도 여주시 금사면 일대
const LAT = 37.37;
const LON = 127.45;
const CACHE_MS = 10 * 60 * 1000;
const RETRY_MS = 2 * 60 * 1000; // 실패 후 다시 시도하기까지 기다리는 시간

let cache = { at: 0, data: null };
let failedAt = 0;

// WMO 날씨 코드 → 한글
function describe(code) {
  if (code === 0) return "맑음";
  if (code <= 2) return "구름 조금";
  if (code === 3) return "흐림";
  if (code <= 48) return "안개";
  if (code <= 57) return "이슬비";
  if (code <= 67) return "비";
  if (code <= 77) return "눈";
  if (code <= 82) return "소나기";
  if (code <= 86) return "눈";
  return "뇌우";
}

export async function getWeather() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  // 직전에 실패했다면 잠시 요청을 멈춘다 (429 차단이 길어지지 않도록)
  if (!cache.data && Date.now() - failedAt < RETRY_MS) return null;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,weather_code&daily=precipitation_probability_max` +
    `&timezone=Asia%2FSeoul&forecast_days=1`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    cache = {
      at: Date.now(),
      data: {
        temp: Math.round(json.current.temperature_2m),
        sky: describe(json.current.weather_code),
        rainChance: json.daily.precipitation_probability_max?.[0] ?? null,
      },
    };
  } catch (err) {
    console.warn("[weather] 날씨 정보를 가져오지 못했습니다:", err.message);
    // 실패해도 직전 값이 있으면 그대로 사용 (10분 뒤 다시 시도)
    // 없으면 null → 브라우저가 Open-Meteo에서 직접 가져온다 (public/js/app.js)
    if (!cache.data) {
      failedAt = Date.now();
      return null;
    }
    cache.at = Date.now();
  }
  return cache.data;
}
