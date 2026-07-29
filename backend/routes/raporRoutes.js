const express = require("express");
const router = express.Router();
const raporController = require("../controllers/raporController");
const dogrula = require("../middleware/auth");

router.get("/gunluk", dogrula, raporController.gunluk);

module.exports = router;
