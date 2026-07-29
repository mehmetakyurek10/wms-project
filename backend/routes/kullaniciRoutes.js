const express = require("express");
const router = express.Router();
const kullaniciController = require("../controllers/kullaniciController");
const dogrula = require("../middleware/auth");
const izinVer = require("../middleware/izinVer");

router.use(dogrula, izinVer("admin"));

router.get("/", kullaniciController.listele);
router.patch("/:id", kullaniciController.guncelle);

module.exports = router;
