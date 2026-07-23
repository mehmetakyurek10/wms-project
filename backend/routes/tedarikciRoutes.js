const express = require("express");
const router = express.Router();
const tedarikciController = require("../controllers/tedarikciController");
const dogrula = require("../middleware/auth");

router.get("/", tedarikciController.listele);
router.post("/", dogrula, tedarikciController.ekle);
router.put("/:id", dogrula, tedarikciController.guncelle);
router.delete("/:id", dogrula, tedarikciController.sil);

module.exports = router;
