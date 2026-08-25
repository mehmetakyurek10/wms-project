const express = require("express");
const router = express.Router();
const lokasyonController = require("../controllers/lokasyonController");
const izinVer = require("../middleware/izinVer");
const { dogrulaGovde } = require("../utils/validation");
const {
  lokasyonEkle,
  lokasyonGuncelle,
  blokOlustur,
} = require("../schemas/location");

router.get("/tutarlilik", izinVer("admin"), lokasyonController.tutarlilik);
router.get("/harita", lokasyonController.harita);
router.get("/", lokasyonController.listele);
router.get("/:id/stok", lokasyonController.stok);
router.post("/", dogrulaGovde(lokasyonEkle), lokasyonController.ekle);
router.put("/:id", dogrulaGovde(lokasyonGuncelle), lokasyonController.guncelle);
router.delete("/:id", izinVer("admin"), lokasyonController.sil);
router.post(
  "/blok-olustur",
  izinVer("admin"),
  dogrulaGovde(blokOlustur),
  lokasyonController.blokOlustur,
);

module.exports = router;
