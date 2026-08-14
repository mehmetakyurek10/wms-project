const config = require("../config/env");
const logger = require("../config/logger");

const hataYonetici = (err, req, res, _next) => {
  const durumKodu = err.statusCode || 500;

  const kayit = req.log || logger;

  if (durumKodu >= 500) {
    kayit.error({ err }, `${req.method} ${req.originalUrl}`);
  } else {
    kayit.warn(
      { hata: err.message, durumKodu },
      `${req.method} ${req.originalUrl}`,
    );
  }

  const mesaj =
    config.uretim && durumKodu >= 500
      ? "Sunucu hatası"
      : err.message || "Sunucu hatası";

  res.status(durumKodu).json({ hata: mesaj });
};

module.exports = hataYonetici;
