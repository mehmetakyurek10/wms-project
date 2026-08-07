const express = require("express");
const router = express.Router();
const satisController = require("../controllers/satisController");

router.get("/", satisController.listele);
router.get("/:id/kalemler", satisController.detay);
router.get("/:id/rezervasyonlar", satisController.rezervasyonlar);
router.post("/", satisController.olustur);
router.patch("/:id/teslim-et", satisController.teslimEt);
router.patch("/:id/iptal", satisController.iptalEt);

module.exports = router;
