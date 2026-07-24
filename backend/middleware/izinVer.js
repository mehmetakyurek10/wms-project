const izinVer = (...izinliRoller) => {
  return (req, res, next) => {
    if (!izinliRoller.includes(req.kullanici.rol)) {
      return res.status(403).json({ hata: "Bu işlem için yetkiniz yok" });
    }
    next();
  };
};

module.exports = izinVer;
