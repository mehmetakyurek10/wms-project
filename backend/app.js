const crypto = require("node:crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const pinoHttp = require("pino-http");
const config = require("./config/env");
const logger = require("./config/logger");
const pool = require("./config/db");
const routes = require("./routes");
const hataYonetici = require("./middleware/hataYonetici");

const app = express();

app.use(
  pinoHttp({
    logger,

    genReqId: (req, res) => {
      const id = crypto.randomUUID();
      res.setHeader("X-Istek-Id", id);
      return id;
    },

    autoLogging: {
      ignore: (req) => req.url === "/saglik" || req.method === "OPTIONS",
    },

    serializers: {
      req: (req) => ({ method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },

    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} ${res.statusCode}`,

    customErrorMessage: (req, res, hata) =>
      `${req.method} ${req.url} ${res.statusCode} ${hata.message}`,

    customLogLevel: (req, res, hata) => {
      if (hata || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  }),
);

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    exposedHeaders: ["X-Toplam-Kayit", "X-Istek-Id"],
  }),
);
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());

app.get("/saglik", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ durum: "ok", veritabani: "bagli" });
  } catch (err) {
    req.log.error({ err }, "Saglik kontrolu: veritabanina baglanilamadi");
    res.status(503).json({ durum: "hata", veritabani: "baglanamadi" });
  }
});

app.use(routes);
app.use((req, res, next) => {
  const hata = new Error("Kaynak bulunamadı");
  hata.statusCode = 404;
  next(hata);
});
app.use(hataYonetici);

module.exports = app;
