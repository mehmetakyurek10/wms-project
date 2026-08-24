const { z } = require("zod");
const {
  kimlik,
  pozitifSayi,
  negatifOlmayanSayi,
} = require("../utils/validation");

const siparisOlustur = z.object({
  tedarikci_id: kimlik("Tedarikçi seçilmelidir"),
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
});

const teslimAl = z.object({
  lokasyon_id: kimlik("Malın indirileceği lokasyon seçilmelidir"),
});

const siparisIptal = z.object({
  aciklama: z
    .string({ message: "İptal sebebi yazılmalıdır" })
    .trim()
    .min(3, { message: "İptal sebebi en az 3 karakter olmalıdır" })
    .max(255, { message: "İptal sebebi 255 karakteri aşamaz" }),
});

module.exports = { siparisOlustur, teslimAl, siparisIptal };
