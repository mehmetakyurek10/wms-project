const express = require("express");
const router = express.Router();
const lokasyonController = require("../controllers/lokasyonController");
const izinVer = require("../middleware/izinVer");

router.get("/tutarlilik", izinVer("admin"), lokasyonController.tutarlilik);
router.get("/", lokasyonController.listele);
router.get("/:id/stok", lokasyonController.stok);
router.post("/", lokasyonController.ekle);
router.put("/:id", lokasyonController.guncelle);
router.delete("/:id", izinVer("admin"), lokasyonController.sil);
router.post("/blok-olustur", izinVer("admin"), lokasyonController.blokOlustur);

module.exports = router;
