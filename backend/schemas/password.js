const { z } = require("zod");

const sifreDegistir = z
  .object({
    currentPassword: z
      .string({ message: "Mevcut şifre ve yeni şifre zorunludur" })
      .min(1, { message: "Mevcut şifre ve yeni şifre zorunludur" }),
    newPassword: z
      .string({ message: "Mevcut şifre ve yeni şifre zorunludur" })
      .min(6, { message: "Yeni şifre en az 6 karakter olmalıdır" }),
  })
  .refine((veri) => veri.currentPassword !== veri.newPassword, {
    message: "Yeni şifre mevcut şifreyle aynı olamaz",
  });

module.exports = { sifreDegistir };
