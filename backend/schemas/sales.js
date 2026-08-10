const { z } = require("zod");
const {
  kimlik,
  pozitifSayi,
  negatifOlmayanSayi,
} = require("../utils/validation");

const siparisOlustur = z.object({
  musteri_id: kimlik("Müşteri seçilmelidir"),
  kalemler: z
    .array(
      z.object({
        varyant_id: kimlik("Her kalemde varyant seçilmelidir"),
        miktar: pozitifSayi("Miktar sıfırdan büyük olmalıdır"),
        birim_fiyat: negatifOlmayanSayi("Birim fiyat geçersiz"),
      }),
      { message: "En az bir kalem eklemelisiniz" },
    )
    .min(1, { message: "En az bir kalem eklemelisiniz" }),
  tahsisler: z
    .array(
      z.object({
        birim_id: kimlik("Geçersiz stok birimi"),
        miktar: pozitifSayi("Ayrılan miktar sıfırdan büyük olmalıdır"),
      }),
      { message: "Stok hangi birimlerden ayrılacak, seçilmelidir" },
    )
    .min(1, { message: "Stok hangi birimlerden ayrılacak, seçilmelidir" }),
});

module.exports = { siparisOlustur };
