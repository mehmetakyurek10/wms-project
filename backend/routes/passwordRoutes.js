const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const passwordController = require("../controllers/passwordController");
const { dogrulaGovde } = require("../utils/validation");
const { sifreDegistir } = require("../schemas/password");

const passwordChangeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    hata: "Çok fazla şifre değiştirme denemesi yapıldı, 15 dakika sonra tekrar deneyin",
  },
});

router.patch(
  "/sifre",
  passwordChangeLimit,
  dogrulaGovde(sifreDegistir),
  passwordController.changePassword,
);

module.exports = router;
