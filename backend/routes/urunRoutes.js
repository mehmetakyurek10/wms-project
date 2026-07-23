const express = require("express");
const router = express.Router();
const urunController = require("../controllers/urunController");
const dogrula = require("../middleware/auth");

router.get("/", urunController.listele);
router.get("/dusuk-stok", urunController.dusukStok);
router.get("/:id", urunController.getirTek);
router.post("/", dogrula, urunController.ekle);
router.put("/:id", dogrula, urunController.guncelle);
router.delete("/:id", dogrula, urunController.sil);

module.exports = router;
