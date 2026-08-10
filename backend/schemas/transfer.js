const { z } = require("zod");
const {
  kimlik,
  opsiyonelPozitifSayi,
  aciklama,
} = require("../utils/validation");

// miktar bilerek opsiyonel: palet butun olarak tasindiginda arayuz bu alani
// hic gondermiyor, tasinan miktar birimin kendi miktarindan okunuyor.
// Dokme transferinde ise zorunlu; bu ayrimi denetleyici yapiyor cunku
// birimin paletmi dokme mi oldugu ancak veritabanindan bilinebiliyor.
const transferOlustur = z.object({
  birim_id: kimlik("Taşınacak birim ve hedef lokasyon zorunludur"),
  hedef_lokasyon_id: kimlik("Taşınacak birim ve hedef lokasyon zorunludur"),
  miktar: opsiyonelPozitifSayi("Miktar sıfırdan büyük olmalıdır"),
  aciklama,
});

module.exports = { transferOlustur };
