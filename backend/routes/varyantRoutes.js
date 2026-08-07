const express = require("express");
const router = express.Router();
const varyantController = require("../controllers/varyantController");
const izinVer = require("../middleware/izinVer");

router.get("/", varyantController.listele);
router.get("/dusuk-stok", varyantController.dusukStok);
router.post("/", varyantController.ekle);
router.put("/:id", varyantController.guncelle);
router.delete("/:id", izinVer("admin"), varyantController.sil);
router.get("/:id/lokasyonlar", varyantController.varyantLokasyonlari);

module.exports = router;
