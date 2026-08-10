const { z } = require("zod");
const {
  bosuAtla,
  opsiyonelKimlik,
  pozitifSayi,
  aciklama,
} = require("../utils/validation");

const SEBEPLER = ["satinalma", "satis", "sayim", "fire", "iade", "manuel"];

const hareketEkle = z
  .object({
    tip: z.enum(["giris", "cikis"], {
      message: "Hareket tipi giris veya cikis olmalı",
    }),
    sebep: bosuAtla(z.enum(SEBEPLER, { message: "Geçersiz sebep" }).optional()),
    miktar: pozitifSayi("Miktar sıfırdan büyük olmalıdır"),
    varyant_id: opsiyonelKimlik("Varyant ve lokasyon seçilmelidir"),
    lokasyon_id: opsiyonelKimlik("Varyant ve lokasyon seçilmelidir"),
    birim_id: opsiyonelKimlik("Çıkış yapılacak stok birimi seçilmelidir"),
    aciklama,
  })
  .superRefine((veri, ctx) => {
    if (veri.tip === "giris" && (!veri.varyant_id || !veri.lokasyon_id)) {
      ctx.addIssue({
        code: "custom",
        message: "Varyant ve lokasyon seçilmelidir",
        path: ["varyant_id"],
      });
    }

    if (veri.tip === "cikis" && !veri.birim_id) {
      ctx.addIssue({
        code: "custom",
        message: "Çıkış yapılacak stok birimi seçilmelidir",
        path: ["birim_id"],
      });
    }
  });

module.exports = { hareketEkle, SEBEPLER };
