const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT k.*, COUNT(u.id) AS urun_sayisi
       FROM kategoriler k
       LEFT JOIN urunler u ON u.kategori_id = k.id
       GROUP BY k.id
       ORDER BY k.ad`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const sil = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [sayim] = await pool.query(
      "SELECT COUNT(*) AS adet FROM urunler WHERE kategori_id = ?",
      [id],
    );

    if (sayim[0].adet > 0) {
      return res.status(409).json({
        hata: `Bu kategoriye bağlı ${sayim[0].adet} ürün var, önce onları başka kategoriye taşıyın`,
      });
    }

    const [sonuc] = await pool.query("DELETE FROM kategoriler WHERE id = ?", [
      id,
    ]);

    if (sonuc.affectedRows === 0) {
      return res.status(404).json({ hata: "Kategori bulunamadı" });
    }

    res.json({ mesaj: "Silindi" });
  } catch (err) {
    next(err);
  }
};

const ekle = async (req, res, next) => {
  try {
    const { ad } = req.body;
    const [result] = await pool.query(
      "INSERT INTO kategoriler (ad) VALUES (?)",
      [ad],
    );
    res.status(201).json({ id: result.insertId, ad });
  } catch (err) {
    next(err);
  }
};

module.exports = { listele, ekle, sil };
