const express = require("express");
const router = express.Router();
const marketTripController = require("../controllers/marketTripController");
const { dogrulaGovde } = require("../utils/validation");
const {
  seferAc,
  seferKapat,
  hasilatGuncelle,
} = require("../schemas/marketTrip");

router.get("/ozet", marketTripController.ozet);
router.get("/", marketTripController.listele);
router.get("/:id/kalemler", marketTripController.detay);
router.post("/", dogrulaGovde(seferAc), marketTripController.seferAc);
router.patch(
  "/:id/kapat",
  dogrulaGovde(seferKapat),
  marketTripController.seferKapat,
);
router.patch(
  "/:id/hasilat",
  dogrulaGovde(hasilatGuncelle),
  marketTripController.hasilatGuncelle,
);

module.exports = router;
