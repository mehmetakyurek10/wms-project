const { z } = require("zod");
const {
  kimlik,
  opsiyonelKimlik,
  negatifOlmayanSayi,
  aciklama,
} = require("../utils/validation");

// Bir kalem ya bir stok birimini ya da bir varyanti sayar. Arayuz bunlardan
// yalnizca birini gonderiyor; denetleyici de once birim_id'ye, yoksa
// varyant_id'ye bakiyor. Ikisinin de bulunmadigi kalem gecersiz.
const sayimKalemi = z
  .object({
    birim_id: opsiyonelKimlik("Geçersiz kalem"),
    varyant_id: opsiyonelKimlik("Geçersiz kalem"),
    sayilan_miktar: negatifOlmayanSayi("Sayılan miktar geçersiz"),
  })
  .refine(
    (kalem) => kalem.birim_id !== undefined || kalem.varyant_id !== undefined,
    {
      message: "Geçersiz kalem",
    },
  );

const sayimKaydet = z.object({
  lokasyon_id: kimlik("Sayım yapılacak lokasyon seçilmelidir"),
  kalemler: z
    .array(sayimKalemi, { message: "Sayılacak kalem gönderilmedi" })
    .min(1, { message: "Sayılacak kalem gönderilmedi" }),
  aciklama,
});

module.exports = { sayimKaydet };
