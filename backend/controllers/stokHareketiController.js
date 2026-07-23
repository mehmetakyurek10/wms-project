const pool = require("../config/db");

const listele = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT sh.*, u.ad AS urun_adi
       FROM stok_hareketleri sh
       JOIN urunler u ON sh.urun_id = u.id
       ORDER BY sh.tarih DESC`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const ekle = async (req, res) => {
  try {
    const { urun_id, tip, miktar, aciklama } = req.body;

    if (!["giris", "cikis", "duzeltme"].includes(tip)) {
      return res
        .status(400)
        .json({
          hata: "Geçersiz hareket tipi (giris, cikis veya duzeltme olmalı)",
        });
    }

    if (tip === "cikis") {
      const [rows] = await pool.query(
        "SELECT miktar FROM urunler WHERE id = ?",
        [urun_id],
      );
      if (!rows.length)
        return res.status(404).json({ hata: "Ürün bulunamadı" });
      if (rows[0].miktar < miktar) {
        return res.status(400).json({ hata: "Yetersiz stok" });
      }
    }

    await pool.query(
      "INSERT INTO stok_hareketleri (urun_id, tip, miktar, aciklama) VALUES (?, ?, ?, ?)",
      [urun_id, tip, miktar, aciklama],
    );

    if (tip === "giris") {
      await pool.query("UPDATE urunler SET miktar = miktar + ? WHERE id = ?", [
        miktar,
        urun_id,
      ]);
    } else if (tip === "cikis") {
      await pool.query("UPDATE urunler SET miktar = miktar - ? WHERE id = ?", [
        miktar,
        urun_id,
      ]);
    } else {
      await pool.query("UPDATE urunler SET miktar = ? WHERE id = ?", [
        miktar,
        urun_id,
      ]);
    }

    res.status(201).json({ mesaj: "Stok hareketi kaydedildi" });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

module.exports = { listele, ekle };
