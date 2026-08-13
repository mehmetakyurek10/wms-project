const { z } = require("zod");
const { kimlik, pozitifSayi, metin } = require("../utils/validation");

const paletle = z.object({
  varyant_id: kimlik("Varyant ve lokasyon zorunludur"),
  lokasyon_id: kimlik("Varyant ve lokasyon zorunludur"),
  miktar: pozitifSayi("Miktar sıfırdan büyük olmalıdır"),
  kod: metin("Palet kodu zorunludur", 30),
});

module.exports = { paletle };
