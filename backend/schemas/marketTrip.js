const { z } = require("zod");
const {
  kimlik,
  pozitifSayi,
  negatifOlmayanSayi,
  bosuAtla,
  aciklama,
} = require("../utils/validation");

const seferAc = z.object({
  lokasyon_id: kimlik("Pazar seçilmelidir"),
  kalemler: z
    .array(
      z.object({
        varyant_id: kimlik("Her kalemde ürün seçilmelidir"),
        miktar: pozitifSayi("Miktar sıfırdan büyük olmalıdır"),
      }),
      { message: "En az bir ürün eklemelisiniz" },
    )
    .min(1, { message: "En az bir ürün eklemelisiniz" }),
  tahsisler: z
    .array(
      z.object({
        birim_id: kimlik("Geçersiz stok birimi"),
        miktar: pozitifSayi("Çıkacak miktar sıfırdan büyük olmalıdır"),
      }),
      { message: "Mal hangi birimlerden çıkacak, seçilmelidir" },
    )
    .min(1, { message: "Mal hangi birimlerden çıkacak, seçilmelidir" }),
  aciklama,
});

const seferKapat = z.object({
  kalemler: z
    .array(
      z.object({
        varyant_id: kimlik("Geçersiz kalem"),
        donen_miktar: negatifOlmayanSayi("Dönen miktar geçersiz"),
      }),
      { message: "Dönen miktarlar gönderilmedi" },
    )
    .min(1, { message: "Dönen miktarlar gönderilmedi" }),
  hasilat: bosuAtla(negatifOlmayanSayi("Hasılat geçersiz").optional()),
});

const hasilatGuncelle = z.object({
  hasilat: negatifOlmayanSayi("Hasılat geçersiz"),
});

module.exports = { seferAc, seferKapat, hasilatGuncelle };
