const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const authController = require("../controllers/authController");
const kayitKorumasi = require("../middleware/kayitKorumasi");

const girisLimiti = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    hata: "Çok fazla giriş denemesi yapıldı, 15 dakika sonra tekrar deneyin",
  },
});

router.post("/kayit", kayitKorumasi, authController.kayitOl);
router.post("/giris", girisLimiti, authController.girisYap);

module.exports = router;
