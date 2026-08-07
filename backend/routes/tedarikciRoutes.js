const express = require("express");
const router = express.Router();
const tedarikciController = require("../controllers/tedarikciController");
const izinVer = require("../middleware/izinVer");

router.get("/", tedarikciController.listele);
router.post("/", tedarikciController.ekle);
router.put("/:id", tedarikciController.guncelle);
router.delete("/:id", izinVer("admin"), tedarikciController.sil);

module.exports = router;
