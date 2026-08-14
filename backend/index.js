const app = require("./app");
const config = require("./config/env");
const logger = require("./config/logger");
const pool = require("./config/db");

const KAPANMA_SURESI = 10000;

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, ortam: config.ortam }, "WMS API baslatildi");
});

const kapat = (sinyal) => {
  logger.info({ sinyal }, "Kapanma sinyali alindi");

  server.close(async () => {
    try {
      await pool.end();
      logger.info("Baglanti havuzu kapatildi, cikiliyor");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Havuz kapatilamadi");
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("Zaman asimi, zorla kapatiliyor");
    process.exit(1);
  }, KAPANMA_SURESI).unref();
};

process.on("SIGTERM", () => kapat("SIGTERM"));
process.on("SIGINT", () => kapat("SIGINT"));
