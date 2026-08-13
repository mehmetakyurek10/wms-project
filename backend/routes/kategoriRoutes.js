const express = require("express");
const router = express.Router();
const kategoriController = require("../controllers/kategoriController");
const izinVer = require("../middleware/izinVer");
const { dogrulaGovde } = require("../utils/validation");
const { kategoriEkle } = require("../schemas/catalog");

router.get("/", kategoriController.listele);
router.post("/", dogrulaGovde(kategoriEkle), kategoriController.ekle);
router.delete("/:id", izinVer("admin"), kategoriController.sil);

module.exports = router;
