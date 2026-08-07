const express = require("express");
const router = express.Router();
const kategoriController = require("../controllers/kategoriController");
const izinVer = require("../middleware/izinVer");

router.get("/", kategoriController.listele);
router.post("/", kategoriController.ekle);
router.delete("/:id", izinVer("admin"), kategoriController.sil);

module.exports = router;
