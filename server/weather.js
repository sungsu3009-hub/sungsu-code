// 실시간 날씨 (Open-Meteo — 무료, API 키 불필요)
// 좌표: 경기도 여주시 금사면 일대
const LAT = 37.37;
const LON = 127.45;
const CACHE_MS = 10 * 60 * 1000;

let cache = { at: 0, data: null };

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
    if (!cache.data) return null;
    cache.at = Date.now();
  }
  return cache.data;
}
