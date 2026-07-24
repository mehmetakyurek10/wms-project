const hataYonetici = (err, req, res, next) => {
  console.error(err);
  res
    .status(err.statusCode || 500)
    .json({ hata: err.message || "Sunucu hatası" });
};

module.exports = hataYonetici;
