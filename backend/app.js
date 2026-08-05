const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const config = require("./config/env");
const pool = require("./config/db");
const routes = require("./routes");
const hataYonetici = require("./middleware/hataYonetici");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    exposedHeaders: ["X-Toplam-Kayit"],
  }),
);
app.use(express.json({ limit: "200kb" }));

app.get("/saglik", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ durum: "ok", veritabani: "bagli" });
  } catch (err) {
    console.error("[SAĞLIK] Veritabanı bağlantısı başarısız:", err.message);
    res.status(503).json({ durum: "hata", veritabani: "baglanamadi" });
  }
});

app.use(routes);
app.use(hataYonetici);

module.exports = app;
