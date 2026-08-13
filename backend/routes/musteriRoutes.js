const express = require("express");
const router = express.Router();
const musteriController = require("../controllers/musteriController");
const izinVer = require("../middleware/izinVer");
const { dogrulaGovde } = require("../utils/validation");
const { musteriKaydet } = require("../schemas/parties");

router.get("/", musteriController.listele);
router.post("/", dogrulaGovde(musteriKaydet), musteriController.ekle);
router.put("/:id", dogrulaGovde(musteriKaydet), musteriController.guncelle);
router.delete("/:id", izinVer("admin"), musteriController.sil);

module.exports = router;
