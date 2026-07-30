const express = require("express");
const router = express.Router();

router.use("/urunler", require("./urunRoutes"));
router.use("/kategoriler", require("./kategoriRoutes"));
router.use("/tedarikciler", require("./tedarikciRoutes"));
router.use("/stok-hareketleri", require("./stokHareketleriRoutes"));
router.use("/satinalma-siparisleri", require("./satinalmaRoutes"));
router.use("/auth", require("./authRoutes"));
router.use("/varyantlar", require("./varyantRoutes"));
router.use("/kullanicilar", require("./kullaniciRoutes"));
router.use("/raporlar", require("./raporRoutes"));
router.use("/musteriler", require("./musteriRoutes"));
router.use("/satis-siparisleri", require("./satisRoutes"));
router.use("/sayim", require("./sayimRoutes"));

module.exports = router;
