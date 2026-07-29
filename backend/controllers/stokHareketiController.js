const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT sh.*, u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg,
              k.ad AS kullanici_adi
       FROM stok_hareketleri sh
       JOIN urun_varyantlari v ON sh.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
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
    const { varyant_id, tip, miktar, aciklama } = req.body;

    if (!["giris", "cikis", "duzeltme"].includes(tip)) {
      connection.release();
      return res.status(400).json({
        hata: "Geçersiz hareket tipi (giris, cikis veya duzeltme olmalı)",
      });
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
       (varyant_id, tip, miktar, aciklama, olusturan_kullanici_id)
       VALUES (?, ?, ?, ?, ?)`,
      [varyant_id, tip, miktar, aciklama, req.kullanici.id],
    );

    if (tip === "giris") {
      await connection.query(
        "UPDATE urun_varyantlari SET miktar = miktar + ? WHERE id = ?",
        [miktar, varyant_id],
      );
    } else if (tip === "cikis") {
      await connection.query(
        "UPDATE urun_varyantlari SET miktar = miktar - ? WHERE id = ?",
        [miktar, varyant_id],
      );
    } else {
      await connection.query(
        "UPDATE urun_varyantlari SET miktar = ? WHERE id = ?",
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
