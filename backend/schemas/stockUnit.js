const { z } = require("zod");
const {
  kimlik,
  pozitifSayi,
  metin,
  opsiyonelMetin,
} = require("../utils/validation");

const paletle = z.object({
  varyant_id: kimlik("Varyant ve lokasyon zorunludur"),
  lokasyon_id: kimlik("Varyant ve lokasyon zorunludur"),
  miktar: pozitifSayi("Miktar sıfırdan büyük olmalıdır"),
  kod: metin("Palet kodu zorunludur", 30),
});

const paleteEkle = z.object({
  miktar: pozitifSayi("Miktar sıfırdan büyük olmalıdır"),
  yeni_kod: opsiyonelMetin(30),
});

module.exports = { paletle, paleteEkle };
