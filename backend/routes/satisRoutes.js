const express = require("express");
const router = express.Router();
const satisController = require("../controllers/satisController");
const dogrula = require("../middleware/auth");

router.get("/", satisController.listele);
router.get("/:id/kalemler", satisController.detay);
router.post("/", dogrula, satisController.olustur);
router.patch("/:id/teslim-et", dogrula, satisController.teslimEt);
router.patch("/:id/iptal", dogrula, satisController.iptalEt);

module.exports = router;
