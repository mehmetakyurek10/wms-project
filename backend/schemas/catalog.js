const { z } = require("zod");
const {
  kimlik,
  opsiyonelKimlik,
  opsiyonelPozitifSayi,
  negatifOlmayanSayi,
  bosuAtla,
  metin,
  opsiyonelMetin,
} = require("../utils/validation");

const negatifOlmayanOpsiyonel = (mesaj) =>
  bosuAtla(negatifOlmayanSayi(mesaj).optional());

const ambalajTipi = bosuAtla(
  z
    .enum(["kova", "teneke"], {
      message: "Ambalaj tipi kova veya teneke olmalıdır",
    })
    .optional(),
);

const kategoriEkle = z.object({
  ad: metin("Kategori adı zorunludur", 50),
});

const urunKaydet = z.object({
  ad: metin("Ürün adı zorunludur", 100),
  kategori_id: opsiyonelKimlik("Geçersiz kategori"),
});

const varyantEkle = z
  .object({
    urun_id: kimlik("Ürün ve boy (kalibre) zorunludur"),
    boy: metin("Ürün ve boy (kalibre) zorunludur", 20),
    ambalaj_tipi: ambalajTipi,
    ambalaj_kg: opsiyonelPozitifSayi("Ambalaj kg sıfırdan büyük olmalıdır"),
    barkod: opsiyonelMetin(50),
    miktar: negatifOlmayanOpsiyonel("Başlangıç stoğu geçersiz"),
    lokasyon_id: opsiyonelKimlik("Geçersiz lokasyon"),
    kritik_seviye: negatifOlmayanOpsiyonel("Kritik seviye geçersiz"),
    toptan_fiyat: negatifOlmayanOpsiyonel("Toptan fiyat geçersiz"),
    perakende_fiyat: negatifOlmayanOpsiyonel("Perakende fiyat geçersiz"),
  })
  .refine((veri) => !veri.miktar || veri.lokasyon_id !== undefined, {
    message: "Başlangıç stoğu girildiğinde lokasyon seçilmelidir",
    path: ["lokasyon_id"],
  });

const varyantGuncelle = z.object({
  boy: metin("Boy (kalibre) zorunludur", 20),
  ambalaj_tipi: ambalajTipi,
  ambalaj_kg: opsiyonelPozitifSayi("Ambalaj kg sıfırdan büyük olmalıdır"),
  barkod: opsiyonelMetin(50),
  kritik_seviye: negatifOlmayanOpsiyonel("Kritik seviye geçersiz"),
  toptan_fiyat: negatifOlmayanOpsiyonel("Toptan fiyat geçersiz"),
  perakende_fiyat: negatifOlmayanOpsiyonel("Perakende fiyat geçersiz"),
  aktif: bosuAtla(z.coerce.boolean().optional()),
});

module.exports = { kategoriEkle, urunKaydet, varyantEkle, varyantGuncelle };
