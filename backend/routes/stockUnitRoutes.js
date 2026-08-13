const express = require("express");
const router = express.Router();
const stockUnitController = require("../controllers/stockUnitController");
const { dogrulaGovde } = require("../utils/validation");
const { paletle } = require("../schemas/stockUnit");

router.get("/", stockUnitController.list);
router.get("/kod/:kod", stockUnitController.findByCode);
router.post("/paletle", dogrulaGovde(paletle), stockUnitController.palletize);

module.exports = router;
