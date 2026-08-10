const express = require("express");
const router = express.Router();
const sayimController = require("../controllers/sayimController");
const { dogrulaGovde } = require("../utils/validation");
const { sayimKaydet } = require("../schemas/stocktake");

router.post("/", dogrulaGovde(sayimKaydet), sayimController.kaydet);

module.exports = router;
