const express = require("express");
const router = express.Router();
const sayimController = require("../controllers/sayimController");
const dogrula = require("../middleware/auth");

router.post("/", dogrula, sayimController.kaydet);

module.exports = router;
