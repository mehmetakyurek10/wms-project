const express = require("express");
const router = express.Router();
const satinalmaController = require("../controllers/satinalmaController");
const dogrula = require("../middleware/auth");

router.get("/", satinalmaController.listele);
router.get("/:id/kalemler", satinalmaController.detay);
router.post("/", dogrula, satinalmaController.olustur);
router.patch("/:id/teslim-al", dogrula, satinalmaController.teslimAl);

module.exports = router;
