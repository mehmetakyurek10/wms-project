const { z } = require("zod");
const { metin, opsiyonelMetin } = require("../utils/validation");

const cariAlanlari = {
  yetkili_kisi: opsiyonelMetin(100),
  telefon: opsiyonelMetin(20),
  email: opsiyonelMetin(100),
  adres: opsiyonelMetin(255),
};

const musteriKaydet = z.object({
  ad: metin("Müşteri adı zorunludur", 100),
  ...cariAlanlari,
});

const tedarikciKaydet = z.object({
  ad: metin("Tedarikçi adı zorunludur", 100),
  ...cariAlanlari,
});

module.exports = { musteriKaydet, tedarikciKaydet };
