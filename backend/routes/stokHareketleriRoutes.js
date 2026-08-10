const express = require("express");
const router = express.Router();
const stokHareketleriController = require("../controllers/stokHareketiController");
const { dogrulaGovde } = require("../utils/validation");
const { hareketEkle } = require("../schemas/stockMovement");

router.get("/", stokHareketleriController.listele);
router.post("/", dogrulaGovde(hareketEkle), stokHareketleriController.ekle);

module.exports = router;
