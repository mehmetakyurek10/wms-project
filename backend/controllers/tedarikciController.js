const pool = require("../config/db");

const listele = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM tedarikciler");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const ekle = async (req, res) => {
  try {
    const { ad, yetkili_kisi, telefon, email, adres } = req.body;
    if (!ad) {
      return res.status(400).json({ hata: "Tedarikçi adı zorunludur" });
    }
    const [result] = await pool.query(
      "INSERT INTO tedarikciler (ad, yetkili_kisi, telefon, email, adres) VALUES (?, ?, ?, ?, ?)",
      [ad, yetkili_kisi, telefon, email, adres],
    );
    res
      .status(201)
      .json({ id: result.insertId, ad, yetkili_kisi, telefon, email, adres });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const guncelle = async (req, res) => {
  try {
    const { ad, yetkili_kisi, telefon, email, adres } = req.body;
    const { id } = req.params;
    const [result] = await pool.query(
      "UPDATE tedarikciler SET ad=?,yetkili_kisi=?,telefon=?,email=?,adres=? WHERE id=?",
      [ad, yetkili_kisi, telefon, email, adres, id],
    );
    res.json({ mesaj: "Güncellendi" });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const sil = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM tedarikciler WHERE id=?", [id]);
    res.json({ mesaj: "Silindi" });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

module.exports = { listele, ekle, guncelle, sil };
