const express = require("express");
const router = express.Router();
const urunController = require("../controllers/urunController");
const izinVer = require("../middleware/izinVer");

router.get("/", urunController.listele);
router.get("/:id", urunController.getirTek);
router.post("/", urunController.ekle);
router.put("/:id", urunController.guncelle);
router.delete("/:id", izinVer("admin"), urunController.sil);

module.exports = router;
