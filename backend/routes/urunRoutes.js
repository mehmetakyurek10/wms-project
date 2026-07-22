const express = require("express");
const router = express.Router();
const urunController = require("../controllers/urunController");

router.get("/", urunController.listele);
router.post("/", urunController.ekle);
router.put("/:id", urunController.guncelle);
router.delete("/:id", urunController.sil);

module.exports = router;
