const express = require("express");
const router = express.Router();
const kategoriController = require("../controllers/kategoriController");
const dogrula = require("../middleware/auth");
const izinVer = require("../middleware/izinVer");

router.get("/", kategoriController.listele);
router.post("/", dogrula, kategoriController.ekle);
router.delete("/:id", dogrula, izinVer("admin"), kategoriController.sil);

module.exports = router;
