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

module.exports = { kullaniciGuncelle };
