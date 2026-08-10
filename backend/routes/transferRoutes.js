const express = require("express");
const router = express.Router();
const transferController = require("../controllers/transferController");
const { dogrulaGovde } = require("../utils/validation");
const { transferOlustur } = require("../schemas/transfer");

router.get("/", transferController.listele);
router.post("/", dogrulaGovde(transferOlustur), transferController.olustur);

module.exports = router;
