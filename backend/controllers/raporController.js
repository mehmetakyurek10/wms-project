const pool = require("../config/db");

function tarihAraligi(req) {
  const bugun = new Date().toISOString().slice(0, 10);
  const baslangic = (req.query.baslangic || bugun) + " 00:00:00";
  const bitis = (req.query.bitis || bugun) + " 23:59:59";
  return [baslangic, bitis];
}

const gunluk = async (req, res, next) => {
  try {
    const [baslangic, bitis] = tarihAraligi(req);

    const [ozet] = await pool.query(
      `SELECT tip, COUNT(*) AS islem_sayisi, COALESCE(SUM(miktar), 0) AS toplam_miktar
       FROM stok_hareketleri
       WHERE tarih BETWEEN ? AND ?
       GROUP BY tip`,
      [baslangic, bitis],
    );

    const [kullanicilar] = await pool.query(
      `SELECT COALESCE(k.ad, 'Bilinmiyor') AS kullanici_adi,
              COUNT(*) AS islem_sayisi,
              SUM(CASE WHEN sh.tip = 'giris' THEN 1 ELSE 0 END) AS giris,
              SUM(CASE WHEN sh.tip = 'cikis' THEN 1 ELSE 0 END) AS cikis,
              SUM(CASE WHEN sh.tip = 'duzeltme' THEN 1 ELSE 0 END) AS duzeltme
       FROM stok_hareketleri sh
       LEFT JOIN kullanicilar k ON sh.olusturan_kullanici_id = k.id
       WHERE sh.tarih BETWEEN ? AND ?
       GROUP BY sh.olusturan_kullanici_id, k.ad
       ORDER BY islem_sayisi DESC`,
      [baslangic, bitis],
    );

    const [kalemler] = await pool.query(
      `SELECT u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg,
              COUNT(*) AS hareket_sayisi,
              SUM(CASE WHEN sh.tip = 'giris' THEN sh.miktar ELSE 0 END) AS toplam_giris,
              SUM(CASE WHEN sh.tip = 'cikis' THEN sh.miktar ELSE 0 END) AS toplam_cikis
       FROM stok_hareketleri sh
       JOIN urun_varyantlari v ON sh.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
       WHERE sh.tarih BETWEEN ? AND ?
       GROUP BY sh.varyant_id, u.ad, v.boy, v.ambalaj_tipi, v.ambalaj_kg
       ORDER BY hareket_sayisi DESC
       LIMIT 10`,
      [baslangic, bitis],
    );

    const [siparis] = await pool.query(
      `SELECT COUNT(*) AS adet, COALESCE(SUM(toplam_tutar), 0) AS tutar
       FROM satinalma_siparisleri
       WHERE siparis_tarihi BETWEEN ? AND ?`,
      [baslangic, bitis],
    );

    res.json({
      baslangic,
      bitis,
      ozet,
      kullanicilar,
      kalemler,
      siparis: siparis[0],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { gunluk };
