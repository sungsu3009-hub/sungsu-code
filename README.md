# 이포CC 웹사이트

웹사이트(`public/`)와 예약 서버(`server/`)가 함께 있는 프로젝트입니다.

## 실행 방법

필요한 것: [Node.js](https://nodejs.org) 22.13 이상

```bash
npm install     # 처음 한 번만
npm start       # 서버 실행 → http://localhost:3000
npm run dev     # 개발용: 코드 저장하면 서버 자동 재시작
```

> `public/index.html`을 더블클릭해서 열면 디자인만 보이고 예약·실시간 정보는 동작하지 않습니다.
> 반드시 서버를 실행한 뒤 `http://localhost:3000`으로 접속하세요.

## 폴더 구조

```
public/            웹사이트 (HTML, CSS, JS, 이미지)
  js/main.js       메뉴·스크롤 등 화면 동작
  js/app.js        서버 연결 (예약, 조회, 날씨, 소식)
server/
  index.js         서버 시작점
  api.js           API 주소들
  db.js            데이터베이스 (SQLite) — 테이블 생성, 기본 데이터
  teetimes.js      티타임 목록, 한국 시간 계산
  weather.js       실시간 날씨 (Open-Meteo)
data/ipocc.db      데이터베이스 파일 (첫 실행 시 자동 생성)
```

## API

| 방식 | 주소 | 설명 |
|---|---|---|
| GET | `/api/today` | 날씨, 코스 상태, 오늘 남은 티타임 |
| GET | `/api/news` | 최근 소식 3개 |
| GET | `/api/slots?date=2026-11-01&course=east` | 날짜·코스별 티타임 (`east` 동코스 / `west` 서코스) |
| POST | `/api/reservations` | 예약 `{ date, course, time, name, phone, players }` |
| POST | `/api/reservations/lookup` | 예약조회 `{ phone, code }` |
| POST | `/api/reservations/:code/cancel` | 예약취소 `{ phone }` |

## 설정 바꾸기

- 티타임 시간대·간격, 예약 가능 기간: `server/teetimes.js`
- 소식 기본 데이터: `server/db.js` (DB 파일을 지우고 재시작하면 다시 생성)
- 포트 번호: 환경변수 `PORT` (기본 3000)
