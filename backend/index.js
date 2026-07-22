const express = require("express");
const cors = require("cors");
require("dotenv").config();
const pool = require("./config/db");
const urunRoutes = require("./routes/urunRoutes");
const kategoriRoutes = require("./routes/kategoriRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "WMS API çalışıyor" });
});

app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS su_an");
    res.json({ baglanti: "basarili", veritabani_saati: rows[0].su_an });
  } catch (err) {
    res.status(500).json({ baglanti: "basarisiz", hata: err.message });
  }
});

app.use("/urunler", urunRoutes);
app.use("/kategoriler", kategoriRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} üzerinde çalışıyor`);
});
