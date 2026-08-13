const express = require("express");
const router = express.Router();
const tedarikciController = require("../controllers/tedarikciController");
const izinVer = require("../middleware/izinVer");
const { dogrulaGovde } = require("../utils/validation");
const { tedarikciKaydet } = require("../schemas/parties");

router.get("/", tedarikciController.listele);
router.post("/", dogrulaGovde(tedarikciKaydet), tedarikciController.ekle);
router.put("/:id", dogrulaGovde(tedarikciKaydet), tedarikciController.guncelle);
router.delete("/:id", izinVer("admin"), tedarikciController.sil);

module.exports = router;
