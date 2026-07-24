const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM kategoriler");
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const ekle = async (req, res, next) => {
  try {
    const { ad } = req.body;

    if (!ad) {
      return res.status(400).json({ hata: "Kategori adı zorunludur" });
    }
    const [result] = await pool.query(
      "INSERT INTO kategoriler (ad) VALUES (?)",
      [ad],
    );
    res.status(201).json({ id: result.insertId, ad });
  } catch (err) {
    next(err);
  }
};

module.exports = { listele, ekle };
