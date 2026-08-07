const express = require("express");
const router = express.Router();
const sayimController = require("../controllers/sayimController");

router.post("/", sayimController.kaydet);

module.exports = router;
