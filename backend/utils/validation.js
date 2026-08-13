const { z } = require("zod");

// Arayuzdeki formlar kontrollu oldugu icin doldurulmamis alanlari bos metin
// olarak gonderiyor. Ornegin giris hareketinde birim_id, cikis hareketinde
// lokasyon_id "" olarak geliyor. Mevcut denetleyiciler bunlari "yok" sayiyor.
// Ayni davranisi korumak sart: z.coerce.number bos metni sessizce 0'a
// cevirdigi icin, on isleme olmadan gonderilmemis bir alan gecersiz sayilir
// ve calisan ekranlar kirilir.
const bosuAtla = (sema) =>
  z.preprocess(
    (deger) => (deger === "" || deger === null ? undefined : deger),
    sema,
  );

const kimlik = (mesaj) =>
  z.coerce
    .number({ message: mesaj })
    .int({ message: mesaj })
    .positive({ message: mesaj });

const opsiyonelKimlik = (mesaj) => bosuAtla(kimlik(mesaj).optional());

const pozitifSayi = (mesaj) =>
  z.coerce.number({ message: mesaj }).positive({ message: mesaj });

const opsiyonelPozitifSayi = (mesaj) => bosuAtla(pozitifSayi(mesaj).optional());

const negatifOlmayanSayi = (mesaj) =>
  z.coerce.number({ message: mesaj }).nonnegative({ message: mesaj });

// aciklama kolonlari VARCHAR(255). Sinir asildiginda MySQL hata verip
// istegin 500 donmesine yol aciyordu; burada anlamli bir 400'e cevriliyor.
const aciklama = bosuAtla(
  z
    .string({ message: "Açıklama metin olmalıdır" })
    .max(255, { message: "Açıklama en fazla 255 karakter olabilir" })
    .optional(),
);
const metin = (mesaj, enFazla) =>
  z
    .string({ message: mesaj })
    .trim()
    .min(1, { message: mesaj })
    .max(enFazla, { message: `En fazla ${enFazla} karakter olabilir` });

const opsiyonelMetin = (enFazla) =>
  bosuAtla(
    z
      .string({ message: "Bu alan metin olmalıdır" })
      .trim()
      .max(enFazla, { message: `En fazla ${enFazla} karakter olabilir` })
      .optional(),
  );

// Ilk hatayi donduruyoruz cunku mevcut denetleyiciler de ilk gecersiz alanda
// donuyordu; istemci tarafinda bir davranis degisikligi olmasin diye.
const dogrulaGovde = (sema) => (req, res, next) => {
  const sonuc = sema.safeParse(req.body);

  if (!sonuc.success) {
    return res.status(400).json({ hata: sonuc.error.issues[0].message });
  }

  req.body = sonuc.data;
  next();
};

module.exports = {
  dogrulaGovde,
  bosuAtla,
  kimlik,
  opsiyonelKimlik,
  pozitifSayi,
  opsiyonelPozitifSayi,
  negatifOlmayanSayi,
  metin,
  opsiyonelMetin,
  aciklama,
};
