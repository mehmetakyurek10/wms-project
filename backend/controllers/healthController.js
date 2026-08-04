const pool = require("../config/db");

const DRIFT_QUERY = `
  SELECT u.ad AS urun_adi, v.boy, v.ambalaj_tipi,
         v.miktar AS toplam,
         COALESCE(SUM(sb.miktar), 0) AS lokasyon_toplami,
         v.miktar - COALESCE(SUM(sb.miktar), 0) AS fark
  FROM urun_varyantlari v
  JOIN urunler u ON v.urun_id = u.id
  LEFT JOIN stok_birimleri sb ON sb.varyant_id = v.id
  GROUP BY v.id, u.ad, v.boy, v.ambalaj_tipi, v.miktar
  HAVING fark <> 0
  ORDER BY ABS(fark) DESC
`;

const NEGATIVE_QUERY = `
  SELECT 'Toplam' AS kaynak, u.ad AS urun_adi, v.boy,
         NULL AS lokasyon_kodu, v.miktar
  FROM urun_varyantlari v
  JOIN urunler u ON v.urun_id = u.id
  WHERE v.miktar < 0
  UNION ALL
  SELECT 'Lokasyon', u.ad, v.boy, l.kod, sb.miktar
  FROM stok_birimleri sb
  JOIN lokasyonlar l ON sb.lokasyon_id = l.id
  JOIN urun_varyantlari v ON sb.varyant_id = v.id
  JOIN urunler u ON v.urun_id = u.id
  WHERE sb.miktar < 0
  ORDER BY miktar
`;

const INACTIVE_LOCATION_QUERY = `
  SELECT l.kod AS lokasyon_kodu, l.ad AS lokasyon_adi,
         u.ad AS urun_adi, v.boy, sb.miktar
  FROM stok_birimleri sb
  JOIN lokasyonlar l ON sb.lokasyon_id = l.id
  JOIN urun_varyantlari v ON sb.varyant_id = v.id
  JOIN urunler u ON v.urun_id = u.id
  WHERE l.aktif = FALSE AND sb.miktar > 0
  ORDER BY l.kod
`;

const OVER_CAPACITY_QUERY = `
  SELECT l.kod AS lokasyon_kodu,
         l.ad AS lokasyon_adi,
         l.kapasite,
         COUNT(*) AS palet_sayisi,
         COUNT(*) - l.kapasite AS asim
  FROM stok_birimleri sb
  JOIN lokasyonlar l ON sb.lokasyon_id = l.id
  WHERE sb.tip = 'palet'
    AND sb.miktar > 0
    AND l.kapasite > 0
  GROUP BY l.id, l.kod, l.ad, l.kapasite
  HAVING palet_sayisi > l.kapasite
  ORDER BY asim DESC
`;

const checks = async (req, res, next) => {
  try {
    const [drift, negative, inactive, overCapacity] = await Promise.all([
      pool.query(DRIFT_QUERY),
      pool.query(NEGATIVE_QUERY),
      pool.query(INACTIVE_LOCATION_QUERY),
      pool.query(OVER_CAPACITY_QUERY),
    ]);

    const kontroller = [
      {
        anahtar: "stok_sapmasi",
        ad: "Stok Sapması",
        seviye: "kritik",
        aciklama:
          "Varyantın toplam miktarı ile lokasyonlardaki miktarların toplamı uyuşmuyor. Stok nerede olduğu bilinmeyen bir duruma düşmüş demektir.",
        kolonlar: [
          { key: "urun_adi", label: "Ürün" },
          { key: "boy", label: "Boy" },
          { key: "ambalaj_tipi", label: "Ambalaj" },
          { key: "toplam", label: "Toplam" },
          { key: "lokasyon_toplami", label: "Lokasyonlarda" },
          { key: "fark", label: "Fark" },
        ],
        satirlar: drift[0],
      },
      {
        anahtar: "negatif_stok",
        ad: "Negatif Stok",
        seviye: "kritik",
        aciklama:
          "Miktar sıfırın altına düşmüş. Fiziksel olarak imkânsız; bir çıkış işlemi kontrolsüz geçmiş demektir.",
        kolonlar: [
          { key: "kaynak", label: "Kaynak" },
          { key: "urun_adi", label: "Ürün" },
          { key: "boy", label: "Boy" },
          { key: "lokasyon_kodu", label: "Lokasyon" },
          { key: "miktar", label: "Miktar" },
        ],
        satirlar: negative[0],
      },
      {
        anahtar: "pasif_lokasyonda_stok",
        ad: "Pasif Lokasyonda Stok",
        seviye: "uyari",
        aciklama:
          "Kullanım dışı bırakılmış lokasyonlarda hâlâ mal duruyor. Sayımda ve toplamada gözden kaçar.",
        kolonlar: [
          { key: "lokasyon_kodu", label: "Lokasyon" },
          { key: "lokasyon_adi", label: "Ad" },
          { key: "urun_adi", label: "Ürün" },
          { key: "boy", label: "Boy" },
          { key: "miktar", label: "Miktar" },
        ],
        satirlar: inactive[0],
      },
      {
        anahtar: "kapasite_asimi",
        ad: "Kapasite Aşımı",
        seviye: "uyari",
        aciklama:
          "Lokasyondaki palet sayısı tanımlı kapasiteyi aşıyor. Kapasitesi tanımsız (0) olan alanlar hesaba katılmaz.",
        kolonlar: [
          { key: "lokasyon_kodu", label: "Lokasyon" },
          { key: "lokasyon_adi", label: "Ad" },
          { key: "kapasite", label: "Kapasite" },
          { key: "palet_sayisi", label: "Palet" },
          { key: "asim", label: "Aşım" },
        ],
        satirlar: overCapacity[0],
      },
    ];

    const toplamSorun = kontroller.reduce(
      (acc, k) => acc + k.satirlar.length,
      0,
    );
    const kritikSorun = kontroller
      .filter((k) => k.seviye === "kritik")
      .reduce((acc, k) => acc + k.satirlar.length, 0);

    res.json({
      olusturulma: new Date().toISOString(),
      toplamSorun,
      kritikSorun,
      kontroller,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { checks };
