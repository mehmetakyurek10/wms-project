const express = require("express");
const router = express.Router();
const kategoriController = require("../controllers/kategoriController");
const dogrula = require("../middleware/auth");

router.get("/", kategoriController.listele);
router.post("/", dogrula, kategoriController.ekle);

module.exports = router;
