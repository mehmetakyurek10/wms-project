const express = require("express");
const router = express.Router();
const stokHareketleriController = require("../controllers/stokHareketiController");
const dogrula = require("../middleware/auth");

router.get("/", stokHareketleriController.listele);
router.post("/", dogrula, stokHareketleriController.ekle);

module.exports = router;
