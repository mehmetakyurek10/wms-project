const pool = require("../config/db");

const kaydet = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { lokasyon_id, kalemler, aciklama } = req.body;

    if (!lokasyon_id) {
      connection.release();
      return res
        .status(400)
        .json({ hata: "Sayım yapılacak lokasyon seçilmelidir" });
    }

    if (!kalemler || !kalemler.length) {
      connection.release();
      return res.status(400).json({ hata: "Sayılacak kalem gönderilmedi" });
    }

    await connection.beginTransaction();

    const sonuclar = [];

    for (const kalem of kalemler) {
      const sayilan = Number(kalem.sayilan_miktar);

      if (Number.isNaN(sayilan) || sayilan < 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ hata: "Sayılan miktar geçersiz" });
      }

      const [varyantRows] = await connection.query(
        "SELECT id FROM urun_varyantlari WHERE id = ?",
        [kalem.varyant_id],
      );

      if (!varyantRows.length) {
        await connection.rollback();
        connection.release();
        return res
          .status(404)
          .json({ hata: `Varyant bulunamadı (id: ${kalem.varyant_id})` });
      }

      const [lokasyonRows] = await connection.query(
        `SELECT miktar FROM varyant_lokasyon
         WHERE varyant_id = ? AND lokasyon_id = ? FOR UPDATE`,
        [kalem.varyant_id, lokasyon_id],
      );

      const mevcut = lokasyonRows.length ? Number(lokasyonRows[0].miktar) : 0;
      const fark = sayilan - mevcut;

      if (fark === 0) continue;

      await connection.query(
        `INSERT INTO stok_hareketleri
         (varyant_id, lokasyon_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
         VALUES (?, ?, ?, 'sayim', ?, ?, ?)`,
        [
          kalem.varyant_id,
          lokasyon_id,
          fark > 0 ? "giris" : "cikis",
          Math.abs(fark),
          aciklama || "Stok sayımı",
          req.kullanici.id,
        ],
      );

      await connection.query(
        `INSERT INTO varyant_lokasyon (varyant_id, lokasyon_id, miktar)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE miktar = ?`,
        [kalem.varyant_id, lokasyon_id, sayilan, sayilan],
      );

      await connection.query(
        "UPDATE urun_varyantlari SET miktar = miktar + ? WHERE id = ?",
        [fark, kalem.varyant_id],
      );

      sonuclar.push({
        varyant_id: kalem.varyant_id,
        mevcut,
        sayilan,
        fark,
      });
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
