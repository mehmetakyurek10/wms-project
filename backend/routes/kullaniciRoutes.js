const express = require("express");
const router = express.Router();
const kullaniciController = require("../controllers/kullaniciController");
const izinVer = require("../middleware/izinVer");
const { dogrulaGovde } = require("../utils/validation");
const { kullaniciGuncelle } = require("../schemas/user");

router.use(izinVer("admin"));

router.get("/", kullaniciController.listele);
router.patch(
  "/:id",
  dogrulaGovde(kullaniciGuncelle),
  kullaniciController.guncelle,
);

module.exports = router;
