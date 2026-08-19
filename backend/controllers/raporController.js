const pool = require("../config/db");
const { yerelTarih, ertesiGun, gecerliGunMu } = require("../utils/tarih");

function tarihAraligi(req) {
  const bugun = yerelTarih();
  const baslangicGunu = req.query.baslangic ?? bugun;
  const bitisGunu = req.query.bitis ?? bugun;

  if (!gecerliGunMu(baslangicGunu) || !gecerliGunMu(bitisGunu)) {
    return { hata: "Tarih biçimi YYYY-AA-GG olmalı" };
  }
  if (baslangicGunu > bitisGunu) {
    return { hata: "Başlangıç tarihi bitiş tarihinden sonra olamaz" };
  }

  return {
    baslangicGunu,
    bitisGunu,
    altSinir: `${baslangicGunu} 00:00:00`,
    ustSinir: `${ertesiGun(bitisGunu)} 00:00:00`,
  };
}

const gunluk = async (req, res, next) => {
  try {
    const aralik = tarihAraligi(req);
    if (aralik.hata) {
      return res.status(400).json({ hata: aralik.hata });
    }
    const { baslangicGunu, bitisGunu, altSinir, ustSinir } = aralik;

    const [ozet] = await pool.query(
      `SELECT tip, COUNT(*) AS islem_sayisi, COALESCE(SUM(miktar), 0) AS toplam_miktar
       FROM stok_hareketleri
       WHERE tarih >= ? AND tarih < ?
       GROUP BY tip`,
      [altSinir, ustSinir],
    );

    const [kullanicilar] = await pool.query(
      `SELECT COALESCE(k.ad, 'Bilinmiyor') AS kullanici_adi,
              COUNT(*) AS islem_sayisi,
              SUM(CASE WHEN sh.tip = 'giris' THEN 1 ELSE 0 END) AS giris,
              SUM(CASE WHEN sh.tip = 'cikis' THEN 1 ELSE 0 END) AS cikis,
              SUM(CASE WHEN sh.tip = 'duzeltme' THEN 1 ELSE 0 END) AS duzeltme
       FROM stok_hareketleri sh
       LEFT JOIN kullanicilar k ON sh.olusturan_kullanici_id = k.id
       WHERE sh.tarih >= ? AND sh.tarih < ?
       GROUP BY sh.olusturan_kullanici_id, k.ad
       ORDER BY islem_sayisi DESC`,
      [altSinir, ustSinir],
    );

    const [kalemler] = await pool.query(
      `SELECT u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg,
              COUNT(*) AS hareket_sayisi,
              SUM(CASE WHEN sh.tip = 'giris' THEN sh.miktar ELSE 0 END) AS toplam_giris,
              SUM(CASE WHEN sh.tip = 'cikis' THEN sh.miktar ELSE 0 END) AS toplam_cikis
       FROM stok_hareketleri sh
       JOIN urun_varyantlari v ON sh.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
       WHERE sh.tarih >= ? AND sh.tarih < ?
       GROUP BY sh.varyant_id, u.ad, v.boy, v.ambalaj_tipi, v.ambalaj_kg
       ORDER BY hareket_sayisi DESC
       LIMIT 10`,
      [altSinir, ustSinir],
    );

    const [satinalma] = await pool.query(
      `SELECT COUNT(*) AS adet, COALESCE(SUM(toplam_tutar), 0) AS tutar
       FROM satinalma_siparisleri
       WHERE siparis_tarihi >= ? AND siparis_tarihi < ?`,
      [altSinir, ustSinir],
    );

    const [satis] = await pool.query(
      `SELECT COUNT(*) AS adet, COALESCE(SUM(toplam_tutar), 0) AS tutar
       FROM satis_siparisleri
       WHERE siparis_tarihi >= ? AND siparis_tarihi < ?`,
      [altSinir, ustSinir],
    );

    res.json({
      baslangic: baslangicGunu,
      bitis: bitisGunu,
      ozet,
      kullanicilar,
      kalemler,
      satinalma: satinalma[0],
      satis: satis[0],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { gunluk };
