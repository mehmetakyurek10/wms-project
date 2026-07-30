const pool = require("../config/db");

const kaydet = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { kalemler, aciklama } = req.body;

    if (!kalemler || !kalemler.length) {
      connection.release();
      return res.status(400).json({ hata: "Sayılacak kalem gönderilmedi" });
    }

    await connection.beginTransaction();

    const sonuclar = [];

    for (const kalem of kalemler) {
      const [rows] = await connection.query(
        "SELECT miktar FROM urun_varyantlari WHERE id = ?",
        [kalem.varyant_id],
      );

      if (!rows.length) {
        await connection.rollback();
        connection.release();
        return res
          .status(404)
          .json({ hata: `Varyant bulunamadı (id: ${kalem.varyant_id})` });
      }

      const sayilan = Number(kalem.sayilan_miktar);

      if (Number.isNaN(sayilan) || sayilan < 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ hata: "Sayılan miktar geçersiz" });
      }

      const mevcut = Number(rows[0].miktar);
      const fark = sayilan - mevcut;

      if (fark === 0) continue;

      await connection.query(
        `INSERT INTO stok_hareketleri
         (varyant_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
         VALUES (?, ?, 'sayim', ?, ?, ?)`,
        [
          kalem.varyant_id,
          fark > 0 ? "giris" : "cikis",
          Math.abs(fark),
          aciklama || "Stok sayımı",
          req.kullanici.id,
        ],
      );

      await connection.query(
        "UPDATE urun_varyantlari SET miktar = ? WHERE id = ?",
        [sayilan, kalem.varyant_id],
      );

      sonuclar.push({ varyant_id: kalem.varyant_id, mevcut, sayilan, fark });
    }

    await connection.commit();
    connection.release();

    res.json({
      mesaj: sonuclar.length
        ? `${sonuclar.length} kalemde düzeltme yapıldı`
        : "Fark bulunamadı, stoklar zaten doğru",
      sonuclar,
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    next(err);
  }
};

module.exports = { kaydet };
