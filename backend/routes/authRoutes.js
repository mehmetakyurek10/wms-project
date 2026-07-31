const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const kayitKorumasi = require("../middleware/kayitKorumasi");

router.post("/kayit", kayitKorumasi, authController.kayitOl);
router.post("/giris", authController.girisYap);

module.exports = router;
