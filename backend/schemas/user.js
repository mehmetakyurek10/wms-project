const { z } = require("zod");
const { bosuAtla } = require("../utils/validation");

const kullaniciGuncelle = z
  .object({
    rol: bosuAtla(
      z
        .enum(["admin", "depo_sorumlusu"], { message: "Geçersiz rol" })
        .optional(),
    ),
    aktif: bosuAtla(z.coerce.boolean().optional()),
  })
  .refine((veri) => veri.rol !== undefined || veri.aktif !== undefined, {
    message: "Güncellenecek alan gönderilmedi",
  });

const sifreSifirla = z.object({
  yeniSifre: z
    .string({ message: "Yeni şifre zorunludur" })
    .min(6, { message: "Yeni şifre en az 6 karakter olmalıdır" }),
});

module.exports = { kullaniciGuncelle, sifreSifirla };
