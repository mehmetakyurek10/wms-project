const express = require("express");
const router = express.Router();
const kategoriController = require("../controllers/kategoriController");

router.get("/", kategoriController.listele);
router.post("/", kategoriController.ekle);

module.exports = router;
