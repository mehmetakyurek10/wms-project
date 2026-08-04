const express = require("express");
const router = express.Router();
const stockUnitController = require("../controllers/stockUnitController");

router.get("/", stockUnitController.list);
router.get("/kod/:kod", stockUnitController.findByCode);
router.post("/paletle", stockUnitController.palletize);

module.exports = router;
