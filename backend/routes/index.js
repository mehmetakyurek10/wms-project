const express = require("express");
const router = express.Router();
const dogrula = require("../middleware/auth");

router.use("/auth", require("./authRoutes"));

router.use(dogrula);

router.use("/hesap", require("./passwordRoutes"));
router.use("/sistem", require("./healthRoutes"));
router.use("/panel", require("./dashboardRoutes"));
router.use("/stok-birimleri", require("./stockUnitRoutes"));
router.use("/urunler", require("./urunRoutes"));
router.use("/kategoriler", require("./kategoriRoutes"));
router.use("/varyantlar", require("./varyantRoutes"));
router.use("/tedarikciler", require("./tedarikciRoutes"));
router.use("/musteriler", require("./musteriRoutes"));
router.use("/stok-hareketleri", require("./stokHareketleriRoutes"));
router.use("/satinalma-siparisleri", require("./satinalmaRoutes"));
router.use("/satis-siparisleri", require("./satisRoutes"));
router.use("/pazar-seferleri", require("./marketTripRoutes"));
router.use("/sayim", require("./sayimRoutes"));
router.use("/raporlar", require("./raporRoutes"));
router.use("/kullanicilar", require("./kullaniciRoutes"));
router.use("/lokasyonlar", require("./lokasyonRoutes"));
router.use("/transferler", require("./transferRoutes"));

module.exports = router;
