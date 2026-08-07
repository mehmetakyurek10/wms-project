const express = require("express");
const router = express.Router();
const kullaniciController = require("../controllers/kullaniciController");
const izinVer = require("../middleware/izinVer");

router.use(izinVer("admin"));

router.get("/", kullaniciController.listele);
router.patch("/:id", kullaniciController.guncelle);

module.exports = router;
