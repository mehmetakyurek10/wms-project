const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const { ara, kategori_id, sayfa, limit } = req.query;

    let kosul = " WHERE 1=1";
    const kosulDegerleri = [];

    if (ara) {
      kosul += " AND u.ad LIKE ?";
      kosulDegerleri.push(`%${ara}%`);
    }

    if (kategori_id) {
      kosul += " AND u.kategori_id = ?";
      kosulDegerleri.push(kategori_id);
    }

    const [sayim] = await pool.query(
      "SELECT COUNT(*) AS toplam FROM urunler u" + kosul,
      kosulDegerleri,
    );
    res.set("X-Toplam-Kayit", sayim[0].toplam);

    let sorgu =
      `SELECT u.id, u.ad, u.kategori_id, u.olusturulma_tarihi,
              k.ad AS kategori_adi,
              COUNT(v.id) AS varyant_sayisi,
              COALESCE(SUM(v.miktar), 0) AS toplam_stok
       FROM urunler u
       LEFT JOIN kategoriler k ON u.kategori_id = k.id
       LEFT JOIN urun_varyantlari v ON v.urun_id = u.id` +
      kosul +
      " GROUP BY u.id";

    const degerler = [...kosulDegerleri];

    if (sayfa || limit) {
      const sayfaNo = parseInt(sayfa, 10) || 1;
      const limitSayi = parseInt(limit, 10) || 10;
      const offset = (sayfaNo - 1) * limitSayi;
      sorgu += " ORDER BY u.ad LIMIT ? OFFSET ?";
      degerler.push(limitSayi, offset);
    } else {
      sorgu += " ORDER BY u.ad";
    }

    const [rows] = await pool.query(sorgu, degerler);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const getirTek = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT u.*, k.ad AS kategori_adi
       FROM urunler u
       LEFT JOIN kategoriler k ON u.kategori_id = k.id
       WHERE u.id = ?`,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ hata: "Ürün bulunamadı" });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const ekle = async (req, res, next) => {
  try {
    const { ad, kategori_id } = req.body;

    if (!ad) {
      return res.status(400).json({ hata: "Ürün adı zorunludur" });
    }

    const [result] = await pool.query(
      "INSERT INTO urunler (ad, kategori_id) VALUES (?, ?)",
      [ad, kategori_id || null],
    );

    res.status(201).json({ id: result.insertId, ad, kategori_id });
  } catch (err) {
    next(err);
  }
};

const guncelle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ad, kategori_id } = req.body;

    if (!ad) {
      return res.status(400).json({ hata: "Ürün adı zorunludur" });
    }

    const [sonuc] = await pool.query(
      "UPDATE urunler SET ad=?, kategori_id=? WHERE id=?",
      [ad, kategori_id || null, id],
    );

    if (sonuc.affectedRows === 0) {
      return res.status(404).json({ hata: "Ürün bulunamadı" });
    }

    res.json({ mesaj: "Güncellendi" });
  } catch (err) {
    next(err);
  }
};

const sil = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [sayim] = await pool.query(
      "SELECT COUNT(*) AS adet FROM urun_varyantlari WHERE urun_id = ?",
      [id],
    );

    if (sayim[0].adet > 0) {
      return res.status(409).json({
        hata: `Bu ürünün ${sayim[0].adet} varyantı var, önce onları silmelisiniz`,
      });
    }

    const [sonuc] = await pool.query("DELETE FROM urunler WHERE id=?", [id]);

    if (sonuc.affectedRows === 0) {
      return res.status(404).json({ hata: "Ürün bulunamadı" });
    }

    res.json({ mesaj: "Silindi" });
  } catch (err) {
    next(err);
  }
};

module.exports = { listele, getirTek, ekle, guncelle, sil };
