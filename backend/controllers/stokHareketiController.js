const pool = require("../config/db");

const GECERLI_SEBEPLER = [
  "satinalma",
  "satis",
  "sayim",
  "fire",
  "iade",
  "manuel",
];

const listele = async (req, res, next) => {
  try {
    const { varyant_id, tip, sebep, baslangic, bitis, sayfa, limit } =
      req.query;

    let kosul = " WHERE 1=1";
    const kosulDegerleri = [];

    if (varyant_id) {
      kosul += " AND sh.varyant_id = ?";
      kosulDegerleri.push(varyant_id);
    }

    if (tip) {
      kosul += " AND sh.tip = ?";
      kosulDegerleri.push(tip);
    }

    if (sebep) {
      kosul += " AND sh.sebep = ?";
      kosulDegerleri.push(sebep);
    }

    if (baslangic) {
      kosul += " AND sh.tarih >= ?";
      kosulDegerleri.push(baslangic + " 00:00:00");
    }

    if (bitis) {
      kosul += " AND sh.tarih <= ?";
      kosulDegerleri.push(bitis + " 23:59:59");
    }

    const [sayim] = await pool.query(
      "SELECT COUNT(*) AS toplam FROM stok_hareketleri sh" + kosul,
      kosulDegerleri,
    );
    res.set("X-Toplam-Kayit", sayim[0].toplam);

    let sorgu =
      `SELECT sh.*, u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg,
              k.ad AS kullanici_adi
       FROM stok_hareketleri sh
       JOIN urun_varyantlari v ON sh.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
       LEFT JOIN kullanicilar k ON sh.olusturan_kullanici_id = k.id` +
      kosul +
      " ORDER BY sh.tarih DESC";

    const degerler = [...kosulDegerleri];

    if (sayfa || limit) {
      const sayfaNo = parseInt(sayfa, 10) || 1;
      const limitSayi = parseInt(limit, 10) || 20;
      const offset = (sayfaNo - 1) * limitSayi;
      sorgu += " LIMIT ? OFFSET ?";
      degerler.push(limitSayi, offset);
    }

    const [rows] = await pool.query(sorgu, degerler);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const ekle = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { varyant_id, tip, sebep, miktar, aciklama } = req.body;

    if (!["giris", "cikis"].includes(tip)) {
      connection.release();
      return res
        .status(400)
        .json({ hata: "Hareket tipi giris veya cikis olmalı" });
    }

    if (sebep && !GECERLI_SEBEPLER.includes(sebep)) {
      connection.release();
      return res.status(400).json({ hata: "Geçersiz sebep" });
    }

    if (!varyant_id) {
      connection.release();
      return res.status(400).json({ hata: "Varyant seçilmelidir" });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT miktar FROM urun_varyantlari WHERE id = ?",
      [varyant_id],
    );

    if (!rows.length) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ hata: "Varyant bulunamadı" });
    }

    if (tip === "cikis" && parseFloat(rows[0].miktar) < parseFloat(miktar)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ hata: "Yetersiz stok" });
    }

    await connection.query(
      `INSERT INTO stok_hareketleri
       (varyant_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [varyant_id, tip, sebep || "manuel", miktar, aciklama, req.kullanici.id],
    );

    if (tip === "giris") {
      await connection.query(
        "UPDATE urun_varyantlari SET miktar = miktar + ? WHERE id = ?",
        [miktar, varyant_id],
      );
    } else {
      await connection.query(
        "UPDATE urun_varyantlari SET miktar = miktar - ? WHERE id = ?",
        [miktar, varyant_id],
      );
    }

    await connection.commit();
    connection.release();

    res.status(201).json({ mesaj: "Stok hareketi kaydedildi" });
  } catch (err) {
    await connection.rollback();
    connection.release();
    next(err);
  }
};

module.exports = { listele, ekle };
