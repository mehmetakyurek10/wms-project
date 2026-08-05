const app = require("./app");
const config = require("./config/env");
const pool = require("./config/db");

const KAPANMA_SURESI = 10000;

const server = app.listen(config.port, () => {
  console.log(
    `[server] WMS API http://localhost:${config.port} üzerinde çalışıyor (${config.ortam})`,
  );
});

const kapat = (sinyal) => {
  console.log(`[server] ${sinyal} alındı, kapanıyor`);

  server.close(async () => {
    try {
      await pool.end();
      console.log("[server] Bağlantı havuzu kapatıldı, çıkılıyor");
      process.exit(0);
    } catch (err) {
      console.error("[server] Havuz kapatılamadı:", err.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("[server] Zaman aşımı, zorla kapatılıyor");
    process.exit(1);
  }, KAPANMA_SURESI).unref();
};

process.on("SIGTERM", () => kapat("SIGTERM"));
process.on("SIGINT", () => kapat("SIGINT"));
