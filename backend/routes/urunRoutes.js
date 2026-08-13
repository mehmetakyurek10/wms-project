const express = require("express");
const router = express.Router();
const urunController = require("../controllers/urunController");
const izinVer = require("../middleware/izinVer");
const { dogrulaGovde } = require("../utils/validation");
const { urunKaydet } = require("../schemas/catalog");

router.get("/", urunController.listele);
router.get("/:id", urunController.getirTek);
router.post("/", dogrulaGovde(urunKaydet), urunController.ekle);
router.put("/:id", dogrulaGovde(urunKaydet), urunController.guncelle);
router.delete("/:id", izinVer("admin"), urunController.sil);

module.exports = router;
