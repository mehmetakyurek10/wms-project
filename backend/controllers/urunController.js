const pool = require("../config/db");

const listele = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM urunler");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const getirTek = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM urunler WHERE id=?", [id]);

    if (!rows.length) {
      return res.status(404).json({ hata: "Ürün bulunamadı" });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const ekle = async (req, res) => {
  try {
    const { ad, kategori_id, miktar, birim, kritik_seviye } = req.body;

    if (!ad || !birim) {
      return res.status(400).json({ hata: "Ürün adı ve birim zorunludur" });
    }

    const [result] = await pool.query(
      "INSERT INTO urunler (ad, kategori_id, miktar, birim, kritik_seviye) VALUES (?, ?, ?, ?, ?)",
      [ad, kategori_id, miktar || 0, birim, kritik_seviye || 0],
    );
    res
      .status(201)
      .json({
        id: result.insertId,
        ad,
        kategori_id,
        miktar,
        birim,
        kritik_seviye,
      });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const guncelle = async (req, res) => {
  try {
    const { id } = req.params;
    const { ad, kategori_id, miktar, birim, kritik_seviye } = req.body;
    await pool.query(
      "UPDATE urunler SET ad=?, kategori_id=?, miktar=?, birim=?, kritik_seviye=? WHERE id=?",
      [ad, kategori_id, miktar, birim, kritik_seviye, id],
    );
    res.json({ mesaj: "Güncellendi" });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const dusukStok = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM urunler WHERE miktar <= kritik_seviye",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const sil = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM urunler WHERE id=?", [id]);
    res.json({ mesaj: "Silindi" });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

module.exports = { listele, ekle, guncelle, sil, dusukStok, getirTek };
