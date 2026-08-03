const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const passwordController = require("../controllers/passwordController");

const passwordChangeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    hata: "Çok fazla şifre değiştirme denemesi yapıldı, 15 dakika sonra tekrar deneyin",
  },
});

router.patch("/sifre", passwordChangeLimit, passwordController.changePassword);

module.exports = router;
