const pool = require("../config/db");

const listele = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM kategoriler");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const ekle = async (req, res) => {
  try {
    const { ad } = req.body;
    const [result] = await pool.query(
      "INSERT INTO kategoriler (ad) VALUES (?)",
      [ad],
    );
    res.status(201).json({ id: result.insertId, ad });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

module.exports = { listele, ekle };
