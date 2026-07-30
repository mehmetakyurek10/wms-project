const express = require("express");
const router = express.Router();
const varyantController = require("../controllers/varyantController");
const dogrula = require("../middleware/auth");
const izinVer = require("../middleware/izinVer");

router.get("/", varyantController.listele);
router.get("/dusuk-stok", varyantController.dusukStok);
router.post("/", dogrula, varyantController.ekle);
router.put("/:id", dogrula, varyantController.guncelle);
router.delete("/:id", dogrula, izinVer("admin"), varyantController.sil);
router.get("/:id/lokasyonlar", varyantController.varyantLokasyonlari);

module.exports = router;
