const express = require("express");
const router = express.Router();
const transferController = require("../controllers/transferController");
const dogrula = require("../middleware/auth");

router.get("/", dogrula, transferController.listele);
router.post("/", dogrula, transferController.olustur);

module.exports = router;
