const express = require("express");
const router = express.Router();
const varyantController = require("../controllers/varyantController");
const izinVer = require("../middleware/izinVer");
const { dogrulaGovde } = require("../utils/validation");
const { varyantEkle, varyantGuncelle } = require("../schemas/catalog");

router.get("/", varyantController.listele);
router.get("/dusuk-stok", varyantController.dusukStok);
router.post("/", dogrulaGovde(varyantEkle), varyantController.ekle);
router.put("/:id", dogrulaGovde(varyantGuncelle), varyantController.guncelle);
router.delete("/:id", izinVer("admin"), varyantController.sil);
router.get("/:id/lokasyonlar", varyantController.varyantLokasyonlari);

module.exports = router;
