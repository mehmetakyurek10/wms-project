const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

router.get("/grafikler", dashboardController.charts);

module.exports = router;
