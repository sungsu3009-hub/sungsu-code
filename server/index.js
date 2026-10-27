// 이포CC 웹 서버 — public 폴더의 웹사이트 + /api 예약 기능
import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { api } from "./api.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // 호스팅 서비스(프록시) 뒤에서도 실제 접속 IP 인식

app.use(express.json({ limit: "10kb" }));
app.use("/api", api);
app.use("/api", (req, res) => res.status(404).json({ error: "없는 API 주소입니다." }));
app.use(
  express.static(resolve(root, "public"), {
    maxAge: "1h",
    // HTML은 매번 새로 확인 → 배포하면 바로 반영 (CSS/JS는 ?v= 번호로 갱신)
    setHeaders: (res, path) => {
      if (path.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

// 처리 중 예기치 못한 오류
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "잘못된 요청 형식입니다." });
  console.error(err);
  res.status(500).json({ error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
});

app.listen(PORT, () => {
  console.log(`이포CC 서버 실행 중 → http://localhost:${PORT}`);
});
