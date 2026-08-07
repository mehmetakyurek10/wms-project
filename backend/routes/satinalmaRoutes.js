const express = require("express");
const router = express.Router();
const satinalmaController = require("../controllers/satinalmaController");

router.get("/", satinalmaController.listele);
router.get("/:id/kalemler", satinalmaController.detay);
router.post("/", satinalmaController.olustur);
router.patch("/:id/teslim-al", satinalmaController.teslimAl);

module.exports = router;
