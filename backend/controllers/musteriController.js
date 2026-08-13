const pool = require("../config/db");
const { buildPagination } = require("../utils/pagination");

const listele = async (req, res, next) => {
  try {
    const { limit, offset } = buildPagination(req.query);

    const [sayim] = await pool.query(
      "SELECT COUNT(*) AS toplam FROM musteriler",
    );
    res.set("X-Toplam-Kayit", sayim[0].toplam);

    const [rows] = await pool.query(
      `SELECT id, ad, yetkili_kisi, telefon, email, adres
       FROM musteriler
       ORDER BY ad
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const ekle = async (req, res, next) => {
  try {
    const { ad, yetkili_kisi, telefon, email, adres } = req.body;
    const [result] = await pool.query(
      "INSERT INTO musteriler (ad, yetkili_kisi, telefon, email, adres) VALUES (?, ?, ?, ?, ?)",
      [ad, yetkili_kisi, telefon, email, adres],
    );

    res.status(201).json({ id: result.insertId, ad });
  } catch (err) {
    next(err);
  }
};

const guncelle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ad, yetkili_kisi, telefon, email, adres } = req.body;
    const [sonuc] = await pool.query(
      "UPDATE musteriler SET ad=?, yetkili_kisi=?, telefon=?, email=?, adres=? WHERE id=?",
      [ad, yetkili_kisi, telefon, email, adres, id],
    );

    if (sonuc.affectedRows === 0) {
      return res.status(404).json({ hata: "Müşteri bulunamadı" });
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
      "SELECT COUNT(*) AS adet FROM satis_siparisleri WHERE musteri_id = ?",
      [id],
    );

    if (sayim[0].adet > 0) {
      return res.status(409).json({
        hata: `Bu müşterinin ${sayim[0].adet} siparişi var, silinemez`,
      });
    }

    const [sonuc] = await pool.query("DELETE FROM musteriler WHERE id=?", [id]);

    if (sonuc.affectedRows === 0) {
      return res.status(404).json({ hata: "Müşteri bulunamadı" });
    }

    res.json({ mesaj: "Silindi" });
  } catch (err) {
    next(err);
  }
};

module.exports = { listele, ekle, guncelle, sil };
