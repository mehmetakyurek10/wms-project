const pool = require("../config/db");

const MAKS_BLOK_KAYIT = 5000;

const listele = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT l.id, l.kod, l.ad, l.tip, l.blok, l.sira, l.derinlik, l.kat,
              l.satir, l.kolon, l.satir_span, l.kolon_span, l.kapasite, l.aktif,
              COALESCE(SUM(sb.miktar), 0) AS toplam_miktar,
              COUNT(CASE WHEN sb.miktar > 0 THEN 1 END) AS kalem_sayisi
       FROM lokasyonlar l
       LEFT JOIN stok_birimleri sb ON sb.lokasyon_id = l.id
       GROUP BY l.id
       ORDER BY l.satir, l.kolon`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const stok = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT sb.id, sb.miktar, sb.varyant_id, sb.tip AS birim_tipi, sb.kod AS birim_kodu,
              u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg, v.barkod
       FROM stok_birimleri sb
       JOIN urun_varyantlari v ON sb.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
       WHERE sb.lokasyon_id = ? AND sb.miktar > 0
       ORDER BY u.ad, v.boy`,
      [id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const ekle = async (req, res, next) => {
  try {
    // Govde schemas/location.js tarafindan dogrulanip sayiya cevrildi.
    const { kod, ad, tip, satir, kolon, satir_span, kolon_span, kapasite } =
      req.body;

    const [result] = await pool.query(
      `INSERT INTO lokasyonlar
       (kod, ad, tip, satir, kolon, satir_span, kolon_span, kapasite)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        kod,
        ad || null,
        tip || "alan",
        satir,
        kolon,
        satir_span || 1,
        kolon_span || 1,
        kapasite || 0,
      ],
    );

    res.status(201).json({ id: result.insertId, kod });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        hata: "Bu kod zaten kullanılıyor ya da bu konumda başka bir lokasyon var",
      });
    }
    next(err);
  }
};

const guncelle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      kod,
      ad,
      tip,
      satir,
      kolon,
      satir_span,
      kolon_span,
      kapasite,
      aktif,
    } = req.body;

    const [sonuc] = await pool.query(
      `UPDATE lokasyonlar
       SET kod=?, ad=?, tip=?, satir=?, kolon=?, satir_span=?, kolon_span=?,
           kapasite=?, aktif=?
       WHERE id=?`,
      [
        kod,
        ad || null,
        tip,
        satir,
        kolon,
        satir_span || 1,
        kolon_span || 1,
        kapasite || 0,
        aktif === undefined ? true : aktif,
        id,
      ],
    );

    if (sonuc.affectedRows === 0) {
      return res.status(404).json({ hata: "Lokasyon bulunamadı" });
    }

    res.json({ mesaj: "Güncellendi" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        hata: "Bu kod zaten kullanılıyor ya da bu konumda başka bir lokasyon var",
      });
    }
    next(err);
  }
};

const sil = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;

    await connection.beginTransaction();

    const [stokSayim] = await connection.query(
      "SELECT COALESCE(SUM(miktar), 0) AS toplam FROM stok_birimleri WHERE lokasyon_id = ?",
      [id],
    );

    if (Number(stokSayim[0].toplam) > 0) {
      await connection.rollback();
      return res.status(409).json({
        hata: "Bu lokasyonda stok var, önce başka bir lokasyona transfer edin",
      });
    }

    const [hareketSayim] = await connection.query(
      "SELECT COUNT(*) AS adet FROM stok_hareketleri WHERE lokasyon_id = ?",
      [id],
    );

    if (hareketSayim[0].adet > 0) {
      await connection.rollback();
      return res.status(409).json({
        hata: `Bu lokasyonun ${hareketSayim[0].adet} stok hareketi var, silinemez. Pasife alabilirsiniz.`,
      });
    }

    const [seferSayim] = await connection.query(
      "SELECT COUNT(*) AS adet FROM pazar_seferleri WHERE lokasyon_id = ?",
      [id],
    );

    if (seferSayim[0].adet > 0) {
      await connection.rollback();
      return res.status(409).json({
        hata: `Bu pazara ait ${seferSayim[0].adet} sefer kaydı var, silinemez. Pasife alabilirsiniz.`,
      });
    }

    await connection.query("DELETE FROM stok_birimleri WHERE lokasyon_id = ?", [
      id,
    ]);

    const [sonuc] = await connection.query(
      "DELETE FROM lokasyonlar WHERE id = ?",
      [id],
    );

    if (sonuc.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ hata: "Lokasyon bulunamadı" });
    }

    await connection.commit();

    res.json({ mesaj: "Lokasyon silindi" });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

const blokOlustur = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const {
      blok,
      sira_baslangic,
      sira_sayisi,
      derinlik,
      kat,
      yon,
      baslangic_satir,
      baslangic_kolon,
      ters,
      derinlik_genislik,
      derinlik_ters,
    } = req.body;

    const ilkSira = sira_baslangic || 1;
    const siraSayisi = sira_sayisi;
    const derinlikSayisi = derinlik;
    const katSayisi = kat;
    const ilkSatir = baslangic_satir || 1;
    const ilkKolon = baslangic_kolon || 1;
    const derinlikGenislik = derinlik_genislik || 1;
    const derinlikTers = derinlik_ters === true;
    const dikey = yon !== "yatay";
    const yonCarpani = ters ? -1 : 1;

    const toplamKayit = siraSayisi * derinlikSayisi * katSayisi;

    if (toplamKayit > MAKS_BLOK_KAYIT) {
      return res.status(400).json({
        hata: `Tek seferde en fazla ${MAKS_BLOK_KAYIT} palet yeri üretilebilir (istenen: ${toplamKayit})`,
      });
    }

    const kayitlar = [];

    for (let s = 0; s < siraSayisi; s++) {
      const siraNo = ilkSira + s;

      for (let d = 1; d <= derinlikSayisi; d++) {
        const derinlikSira = derinlikTers ? derinlikSayisi - d : d - 1;

        const satir = dikey
          ? ilkSatir + s * yonCarpani
          : ilkSatir + derinlikSira * derinlikGenislik;
        const kolon = dikey
          ? ilkKolon + derinlikSira * derinlikGenislik
          : ilkKolon + s * yonCarpani;

        const satirSpan = dikey ? 1 : derinlikGenislik;
        const kolonSpan = dikey ? derinlikGenislik : 1;

        for (let k = 1; k <= katSayisi; k++) {
          const kod = `${blok}-${String(siraNo).padStart(2, "0")}-${String(d).padStart(2, "0")}-K${k}`;
          kayitlar.push([
            kod,
            blok,
            siraNo,
            d,
            k,
            satir,
            kolon,
            satirSpan,
            kolonSpan,
            "palet",
            1,
          ]);
        }
      }
    }

    await connection.beginTransaction();

    const [sonuc] = await connection.query(
      `INSERT IGNORE INTO lokasyonlar
       (kod, blok, sira, derinlik, kat, satir, kolon, satir_span, kolon_span, tip, kapasite)
       VALUES ?`,
      [kayitlar],
    );

    await connection.commit();

    const olusan = sonuc.affectedRows;

    res.status(201).json({
      mesaj: `${olusan} palet yeri oluşturuldu${
        olusan < kayitlar.length
          ? `, ${kayitlar.length - olusan} tanesi zaten vardı`
          : ""
      }`,
      olusan,
      istenen: kayitlar.length,
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

const tutarlilik = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.id AS varyant_id, u.ad AS urun_adi, v.boy, v.ambalaj_tipi,
              v.miktar AS toplam,
              COALESCE(SUM(sb.miktar), 0) AS lokasyon_toplami,
              v.miktar - COALESCE(SUM(sb.miktar), 0) AS fark
       FROM urun_varyantlari v
       JOIN urunler u ON v.urun_id = u.id
       LEFT JOIN stok_birimleri sb ON sb.varyant_id = v.id
       GROUP BY v.id
       HAVING fark <> 0
       ORDER BY ABS(fark) DESC`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listele,
  stok,
  ekle,
  guncelle,
  sil,
  blokOlustur,
  tutarlilik,
};
