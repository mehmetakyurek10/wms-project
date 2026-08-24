const express = require("express");
const router = express.Router();
const satinalmaController = require("../controllers/satinalmaController");
const izinVer = require("../middleware/izinVer");
const { dogrulaGovde } = require("../utils/validation");
const {
  siparisOlustur,
  teslimAl,
  siparisIptal,
} = require("../schemas/purchasing");

router.get("/", satinalmaController.listele);
router.get("/:id/kalemler", satinalmaController.detay);
router.post("/", dogrulaGovde(siparisOlustur), satinalmaController.olustur);
router.patch(
  "/:id/teslim-al",
  dogrulaGovde(teslimAl),
  satinalmaController.teslimAl,
);
router.patch(
  "/:id/iptal",
  izinVer("admin"),
  dogrulaGovde(siparisIptal),
  satinalmaController.iptal,
);

module.exports = router;
