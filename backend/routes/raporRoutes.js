const express = require("express");
const router = express.Router();
const raporController = require("../controllers/raporController");

router.get("/gunluk", raporController.gunluk);

module.exports = router;
