const express = require("express");
const router = express.Router();
const stokHareketleriController = require("../controllers/stokHareketiController");

router.get("/", stokHareketleriController.listele);
router.post("/", stokHareketleriController.ekle);

module.exports = router;
