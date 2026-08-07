const express = require("express");
const router = express.Router();
const transferController = require("../controllers/transferController");

router.get("/", transferController.listele);
router.post("/", transferController.olustur);

module.exports = router;
