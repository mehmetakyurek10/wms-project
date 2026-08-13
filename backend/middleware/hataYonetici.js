const config = require("../config/env");

const hataYonetici = (err, req, res, _next) => {
  const durumKodu = err.statusCode || 500;

  console.error(`[HATA] ${req.method} ${req.originalUrl} →`, err);

  const mesaj =
    config.uretim && durumKodu >= 500
      ? "Sunucu hatası"
      : err.message || "Sunucu hatası";

  res.status(durumKodu).json({ hata: mesaj });
};

module.exports = hataYonetici;
