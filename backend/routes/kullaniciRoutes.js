const express = require("express");
const router = express.Router();
const kullaniciController = require("../controllers/kullaniciController");
const izinVer = require("../middleware/izinVer");
const { dogrulaGovde } = require("../utils/validation");
const { kullaniciGuncelle, sifreSifirla } = require("../schemas/user");

router.use(izinVer("admin"));

router.get("/", kullaniciController.listele);
router.patch(
  "/:id",
  dogrulaGovde(kullaniciGuncelle),
  kullaniciController.guncelle,
);
router.post(
  "/:id/sifre-sifirla",
  dogrulaGovde(sifreSifirla),
  kullaniciController.sifreSifirla,
);

module.exports = router;
