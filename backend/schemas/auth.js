const { z } = require("zod");
const { bosuAtla, metin } = require("../utils/validation");

const ZORUNLU = "Ad, email ve şifre zorunludur";

const kayit = z.object({
  ad: metin(ZORUNLU, 100),
  email: z
    .string({ message: ZORUNLU })
    .trim()
    .min(1, { message: ZORUNLU })
    .max(100, { message: "E-posta en fazla 100 karakter olabilir" })
    .email({ message: "Geçerli bir e-posta adresi girin" }),
  sifre: z
    .string({ message: ZORUNLU })
    .min(6, { message: "Şifre en az 6 karakter olmalıdır" }),
  rol: bosuAtla(
    z.enum(["admin", "depo_sorumlusu"], { message: "Geçersiz rol" }).optional(),
  ),
});

// Giriste e-posta bicimi denetlenmiyor. Amac kimligi dogrulamak; bicim
// hatasi ile yanlis parola arasinda ayrim yapmak, var olmayan hesaplari
// ele verir. Yanit her iki durumda da ayni olmali.
const giris = z.object({
  email: z
    .string({ message: "Email ve şifre zorunludur" })
    .trim()
    .min(1, { message: "Email ve şifre zorunludur" }),
  sifre: z
    .string({ message: "Email ve şifre zorunludur" })
    .min(1, { message: "Email ve şifre zorunludur" }),
});

module.exports = { kayit, giris };
