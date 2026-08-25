const { z } = require("zod");
const {
  bosuAtla,
  negatifOlmayanSayi,
  metin,
  opsiyonelMetin,
} = require("../utils/validation");

const LOKASYON_TIPLERI = [
  "palet",
  "raf",
  "alan",
  "kabul",
  "sevkiyat",
  "soguk_oda",
  "koridor",
  "ofis",
  "pazar",
];

const tip = z.enum(LOKASYON_TIPLERI, {
  message: "Geçersiz lokasyon tipi",
});

const enAzBir = (mesaj) =>
  z.coerce.number({ message: mesaj }).int({ message: mesaj }).min(1, {
    message: mesaj,
  });

const opsiyonelEnAzBir = (mesaj) => bosuAtla(enAzBir(mesaj).optional());

const lokasyonEkle = z.object({
  kod: metin("Kod, satır ve kolon zorunludur", 20),
  ad: opsiyonelMetin(100),
  tip: bosuAtla(tip.optional()),
  satir: enAzBir("Satır 1 veya daha büyük olmalıdır"),
  kolon: enAzBir("Kolon 1 veya daha büyük olmalıdır"),
  satir_span: opsiyonelEnAzBir("Satır yayılması 1 veya daha büyük olmalıdır"),
  kolon_span: opsiyonelEnAzBir("Kolon yayılması 1 veya daha büyük olmalıdır"),
  kapasite: bosuAtla(negatifOlmayanSayi("Kapasite geçersiz").optional()),
});

const lokasyonGuncelle = lokasyonEkle.extend({
  kod: metin("Kod, tip, satır ve kolon zorunludur", 20),
  tip,
  aktif: bosuAtla(z.coerce.boolean().optional()),
});

const blokOlustur = z.object({
  blok: metin("Blok, sıra sayısı, derinlik ve kat zorunludur", 10),
  sira_sayisi: enAzBir("Sıra, derinlik ve kat 1 veya daha büyük olmalıdır"),
  derinlik: enAzBir("Sıra, derinlik ve kat 1 veya daha büyük olmalıdır"),
  kat: enAzBir("Sıra, derinlik ve kat 1 veya daha büyük olmalıdır"),
  sira_baslangic: opsiyonelEnAzBir("İlk sıra 1 veya daha büyük olmalıdır"),
  baslangic_satir: opsiyonelEnAzBir(
    "Başlangıç satırı 1 veya daha büyük olmalıdır",
  ),
  baslangic_kolon: opsiyonelEnAzBir(
    "Başlangıç kolonu 1 veya daha büyük olmalıdır",
  ),
  derinlik_genislik: opsiyonelEnAzBir(
    "Derinlik genişliği 1 veya daha büyük olmalıdır",
  ),
  yon: bosuAtla(
    z
      .enum(["dikey", "yatay"], { message: "Yön dikey veya yatay olmalıdır" })
      .optional(),
  ),
  ters: z.boolean({ message: "Geçersiz değer" }).optional(),
  derinlik_ters: z.boolean({ message: "Geçersiz değer" }).optional(),
});

const aktiflikGuncelle = z.object({
  aktif: z.boolean({ message: "Aktiflik değeri true ya da false olmalıdır" }),
});

module.exports = {
  lokasyonEkle,
  lokasyonGuncelle,
  blokOlustur,
  aktiflikGuncelle,
};
