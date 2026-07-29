const express = require("express");
const router = express.Router();

router.use("/urunler", require("./urunRoutes"));
router.use("/kategoriler", require("./kategoriRoutes"));
router.use("/tedarikciler", require("./tedarikciRoutes"));
router.use("/stok-hareketleri", require("./stokHareketleriRoutes"));
router.use("/satinalma-siparisleri", require("./satinalmaRoutes"));
router.use("/auth", require("./authRoutes"));
router.use("/varyantlar", require("./varyantRoutes"));

module.exports = router;
