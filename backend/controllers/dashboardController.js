const pool = require("../config/db");
const { yerelTarih, ertesiGun } = require("../utils/tarih");

const GUN_SAYISI = 14;

const DAILY_QUERY = `
  SELECT DATE_FORMAT(tarih, '%Y-%m-%d') AS gun,
         SUM(CASE WHEN tip = 'giris' THEN miktar ELSE 0 END) AS giris,
         SUM(CASE WHEN tip = 'cikis' THEN miktar ELSE 0 END) AS cikis
  FROM stok_hareketleri
  WHERE tarih >= ? AND tarih < ?
  GROUP BY gun
  ORDER BY gun
`;

const TOP_VARIANTS_QUERY = `
  SELECT CONCAT(u.ad, ' · ', v.boy) AS ad,
         COUNT(*) AS hareket_sayisi
  FROM stok_hareketleri sh
  JOIN urun_varyantlari v ON sh.varyant_id = v.id
  JOIN urunler u ON v.urun_id = u.id
  WHERE sh.tarih >= ? AND sh.tarih < ?
  GROUP BY sh.varyant_id, u.ad, v.boy
  ORDER BY hareket_sayisi DESC
  LIMIT 10
`;

const OCCUPANCY_QUERY = `
  SELECT CASE
           WHEN l.blok IS NULL OR l.blok = '' THEN COALESCE(l.ad, l.kod)
           ELSE l.blok
         END AS bolge,
         SUM(sb.miktar) AS miktar
  FROM stok_birimleri sb
  JOIN lokasyonlar l ON sb.lokasyon_id = l.id
  WHERE sb.miktar > 0
  GROUP BY bolge
  ORDER BY miktar DESC
`;

function buildDayRange(dayCount) {
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (dayCount - 1),
  );

  const days = [];
  for (let i = 0; i < dayCount; i++) {
    const day = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + i,
    );
    days.push(yerelTarih(day));
  }

  return {
    days,
    lowerBound: `${days[0]} 00:00:00`,
    upperBound: `${ertesiGun(days[days.length - 1])} 00:00:00`,
  };
}

const charts = async (req, res, next) => {
  try {
    const { days, lowerBound, upperBound } = buildDayRange(GUN_SAYISI);

    const [daily, topVariants, occupancy] = await Promise.all([
      pool.query(DAILY_QUERY, [lowerBound, upperBound]),
      pool.query(TOP_VARIANTS_QUERY, [lowerBound, upperBound]),
      pool.query(OCCUPANCY_QUERY),
    ]);

    const dailyMap = new Map(daily[0].map((row) => [row.gun, row]));

    const gunlukHareketler = days.map((gun) => {
      const row = dailyMap.get(gun);
      return {
        gun,
        giris: row ? Number(row.giris) : 0,
        cikis: row ? Number(row.cikis) : 0,
      };
    });

    res.json({
      gunSayisi: GUN_SAYISI,
      gunlukHareketler,
      enCokHareket: topVariants[0].map((row) => ({
        ad: row.ad,
        hareket_sayisi: Number(row.hareket_sayisi),
      })),
      lokasyonDoluluk: occupancy[0].map((row) => ({
        bolge: row.bolge,
        miktar: Number(row.miktar),
      })),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { charts };
