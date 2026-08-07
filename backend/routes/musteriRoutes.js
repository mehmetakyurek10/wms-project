const express = require("express");
const router = express.Router();
const musteriController = require("../controllers/musteriController");
const izinVer = require("../middleware/izinVer");

router.get("/", musteriController.listele);
router.post("/", musteriController.ekle);
router.put("/:id", musteriController.guncelle);
router.delete("/:id", izinVer("admin"), musteriController.sil);

module.exports = router;
