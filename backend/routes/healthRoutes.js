const express = require("express");
const router = express.Router();
const healthController = require("../controllers/healthController");
const izinVer = require("../middleware/izinVer");

router.get("/kontroller", izinVer("admin"), healthController.checks);

module.exports = router;
