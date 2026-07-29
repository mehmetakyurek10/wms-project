const express = require("express");
const router = express.Router();
const musteriController = require("../controllers/musteriController");
const dogrula = require("../middleware/auth");
const izinVer = require("../middleware/izinVer");

router.get("/", musteriController.listele);
router.post("/", dogrula, musteriController.ekle);
router.put("/:id", dogrula, musteriController.guncelle);
router.delete("/:id", dogrula, izinVer("admin"), musteriController.sil);

module.exports = router;
