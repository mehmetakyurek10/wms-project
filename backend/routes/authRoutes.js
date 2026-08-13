const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const authController = require("../controllers/authController");
const kayitKorumasi = require("../middleware/kayitKorumasi");
const { dogrulaGovde } = require("../utils/validation");
const { kayit, giris } = require("../schemas/auth");

const girisLimiti = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    hata: "Çok fazla giriş denemesi yapıldı, 15 dakika sonra tekrar deneyin",
  },
});

const yenilemeLimiti = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    hata: "Çok fazla yenileme isteği yapıldı, biraz sonra tekrar deneyin",
  },
});

router.get("/kurulum", authController.kurulumDurumu);
router.post(
  "/kayit",
  kayitKorumasi,
  dogrulaGovde(kayit),
  authController.kayitOl,
);
router.post(
  "/giris",
  girisLimiti,
  dogrulaGovde(giris),
  authController.girisYap,
);
router.post("/yenile", yenilemeLimiti, authController.yenile);
router.post("/cikis", authController.cikisYap);

module.exports = router;
