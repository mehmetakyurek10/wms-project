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

const UNFULFILLABLE_RESERVATION_QUERY = `
  SELECT sb.kod AS birim_kodu,
         l.kod AS lokasyon_kodu,
         u.ad AS urun_adi,
         v.boy,
         sb.miktar AS mevcut,
         SUM(r.miktar) AS ayrilan,
         SUM(r.miktar) - sb.miktar AS eksik,
         GROUP_CONCAT(DISTINCT r.siparis_id ORDER BY r.siparis_id) AS siparisler
  FROM stok_rezervasyonlari r
  JOIN stok_birimleri sb ON r.birim_id = sb.id
  JOIN lokasyonlar l ON sb.lokasyon_id = l.id
  JOIN urun_varyantlari v ON sb.varyant_id = v.id
  JOIN urunler u ON v.urun_id = u.id
  GROUP BY sb.id, sb.kod, l.kod, u.ad, v.boy, sb.miktar
  HAVING ayrilan > sb.miktar
  ORDER BY eksik DESC
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

const MARKET_LEFTOVER_QUERY = `
  SELECT l.kod AS lokasyon_kodu, l.ad AS lokasyon_adi,
         u.ad AS urun_adi, v.boy, sb.miktar
  FROM stok_birimleri sb
  JOIN lokasyonlar l ON sb.lokasyon_id = l.id
  JOIN urun_varyantlari v ON sb.varyant_id = v.id
  JOIN urunler u ON v.urun_id = u.id
  WHERE l.tip = 'pazar'
    AND sb.miktar > 0
    AND NOT EXISTS (
      SELECT 1 FROM pazar_seferleri s
      WHERE s.lokasyon_id = l.id AND s.durum = 'yolda'
    )
  ORDER BY l.kod
`;

const checks = async (req, res, next) => {
  try {
    const [
      drift,
      negative,
      unfulfillable,
      inactive,
      overCapacity,
      marketLeftover,
    ] = await Promise.all([
      pool.query(DRIFT_QUERY),
      pool.query(NEGATIVE_QUERY),
      pool.query(UNFULFILLABLE_RESERVATION_QUERY),
      pool.query(INACTIVE_LOCATION_QUERY),
      pool.query(OVER_CAPACITY_QUERY),
      pool.query(MARKET_LEFTOVER_QUERY),
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
        anahtar: "karsilanamayan_rezervasyon",
        ad: "Karşılanamayan Rezervasyon",
        seviye: "kritik",
        aciklama:
          "Siparişlere ayrılan miktar, birimde fiilen bulunan maldan fazla. Genellikle sayım sonrası oluşur. İlgili siparişler teslim edilemez; müşteriyle görüşülüp sipariş düzeltilmelidir.",
        kolonlar: [
          { key: "birim_kodu", label: "Palet" },
          { key: "lokasyon_kodu", label: "Lokasyon" },
          { key: "urun_adi", label: "Ürün" },
          { key: "boy", label: "Boy" },
          { key: "mevcut", label: "Mevcut" },
          { key: "ayrilan", label: "Ayrılan" },
          { key: "eksik", label: "Eksik" },
          { key: "siparisler", label: "Siparişler" },
        ],
        satirlar: unfulfillable[0],
      },
      {
        anahtar: "pazarda_kalinti",
        ad: "Pazarda Kalıntı Stok",
        seviye: "kritik",
        aciklama:
          "Açık seferi olmayan bir pazar lokasyonunda mal duruyor. Sefer kapanışında pazarın boşalması gerekir; kalıntı varsa satılan miktar eksik hesaplanmış ya da mal elle oraya konmuş olabilir.",
        kolonlar: [
          { key: "lokasyon_kodu", label: "Pazar" },
          { key: "lokasyon_adi", label: "Ad" },
          { key: "urun_adi", label: "Ürün" },
          { key: "boy", label: "Boy" },
          { key: "miktar", label: "Miktar" },
        ],
        satirlar: marketLeftover[0],
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
