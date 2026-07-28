const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT sh.*, u.ad AS urun_adi, k.ad AS kullanici_adi
       FROM stok_hareketleri sh
       JOIN urunler u ON sh.urun_id = u.id
       LEFT JOIN kullanicilar k ON sh.olusturan_kullanici_id = k.id
       ORDER BY sh.tarih DESC`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const ekle = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { urun_id, tip, miktar, aciklama } = req.body;

    if (!["giris", "cikis", "duzeltme"].includes(tip)) {
      connection.release();
      return res.status(400).json({
        hata: "Geçersiz hareket tipi (giris, cikis veya duzeltme olmalı)",
      });
    }

    await connection.beginTransaction();

    if (tip === "cikis") {
      const [rows] = await connection.query(
        "SELECT miktar FROM urunler WHERE id = ?",
        [urun_id],
      );
      if (!rows.length) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ hata: "Ürün bulunamadı" });
      }
      if (rows[0].miktar < miktar) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ hata: "Yetersiz stok" });
      }
    }

    await connection.query(
      "INSERT INTO stok_hareketleri (urun_id, tip, miktar, aciklama, olusturan_kullanici_id) VALUES (?, ?, ?, ?, ?)",
      [urun_id, tip, miktar, aciklama, req.kullanici.id],
    );

    if (tip === "giris") {
      await connection.query(
        "UPDATE urunler SET miktar = miktar + ? WHERE id = ?",
        [miktar, urun_id],
      );
    } else if (tip === "cikis") {
      await connection.query(
        "UPDATE urunler SET miktar = miktar - ? WHERE id = ?",
        [miktar, urun_id],
      );
    } else {
      await connection.query("UPDATE urunler SET miktar = ? WHERE id = ?", [
        miktar,
        urun_id,
      ]);
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
