const express = require("express");
const router = express.Router();
const lokasyonController = require("../controllers/lokasyonController");
const dogrula = require("../middleware/auth");
const izinVer = require("../middleware/izinVer");

router.get(
  "/tutarlilik",
  dogrula,
  izinVer("admin"),
  lokasyonController.tutarlilik,
);
router.get("/", lokasyonController.listele);
router.get("/:id/stok", lokasyonController.stok);
router.post("/", dogrula, lokasyonController.ekle);
router.put("/:id", dogrula, lokasyonController.guncelle);
router.delete("/:id", dogrula, izinVer("admin"), lokasyonController.sil);
router.post(
  "/blok-olustur",
  dogrula,
  izinVer("admin"),
  lokasyonController.blokOlustur,
);

module.exports = router;
