const pool = require("../config/db");

const kaydet = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { lokasyon_id, kalemler, aciklama } = req.body;

    if (!lokasyon_id) {
      return res
        .status(400)
        .json({ hata: "Sayım yapılacak lokasyon seçilmelidir" });
    }

    if (!Array.isArray(kalemler) || !kalemler.length) {
      return res.status(400).json({ hata: "Sayılacak kalem gönderilmedi" });
    }

    const sayimlar = new Map();

    for (const kalem of kalemler) {
      const varyantId = Number(kalem.varyant_id);
      const sayilan = Number(kalem.sayilan_miktar);

      if (!Number.isInteger(varyantId) || varyantId <= 0) {
        return res.status(400).json({ hata: "Geçersiz varyant" });
      }

      if (!Number.isFinite(sayilan) || sayilan < 0) {
        return res.status(400).json({ hata: "Sayılan miktar geçersiz" });
      }

      if (sayimlar.has(varyantId)) {
        return res.status(400).json({
          hata: `Aynı varyant listede birden fazla kez var (id: ${varyantId})`,
        });
      }

      sayimlar.set(varyantId, sayilan);
    }

    const varyantIdleri = [...sayimlar.keys()].sort((a, b) => a - b);

    await connection.beginTransaction();

    const [lokasyonRows] = await connection.query(
      "SELECT id FROM lokasyonlar WHERE id = ? AND aktif = TRUE",
      [lokasyon_id],
    );

    if (!lokasyonRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Lokasyon bulunamadı" });
    }

    const [varyantRows] = await connection.query(
      "SELECT id FROM urun_varyantlari WHERE id IN (?)",
      [varyantIdleri],
    );

    if (varyantRows.length !== varyantIdleri.length) {
      const bulunanlar = new Set(varyantRows.map((r) => r.id));
      const eksik = varyantIdleri.filter((id) => !bulunanlar.has(id));
      await connection.rollback();
      return res
        .status(404)
        .json({ hata: `Varyant bulunamadı (id: ${eksik.join(", ")})` });
    }

    const sonuclar = [];

    for (const varyantId of varyantIdleri) {
      const sayilan = sayimlar.get(varyantId);

      const [stokRows] = await connection.query(
        `SELECT miktar FROM stok_birimleri
         WHERE tip = 'dokme' AND varyant_id = ? AND lokasyon_id = ?
         FOR UPDATE`,
        [varyantId, lokasyon_id],
      );

      const mevcut = stokRows.length ? Number(stokRows[0].miktar) : 0;
      const fark = sayilan - mevcut;

      if (fark === 0) continue;

      await connection.query(
        `INSERT INTO stok_hareketleri
         (varyant_id, lokasyon_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
         VALUES (?, ?, ?, 'sayim', ?, ?, ?)`,
        [
          varyantId,
          lokasyon_id,
          fark > 0 ? "giris" : "cikis",
          Math.abs(fark),
          aciklama || "Stok sayımı",
          req.kullanici.id,
        ],
      );

      await connection.query(
        `INSERT INTO stok_birimleri
         (tip, varyant_id, lokasyon_id, miktar, olusturan_kullanici_id)
         VALUES ('dokme', ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE miktar = ?`,
        [varyantId, lokasyon_id, sayilan, req.kullanici.id, sayilan],
      );

      await connection.query(
        "UPDATE urun_varyantlari SET miktar = miktar + ? WHERE id = ?",
        [fark, varyantId],
      );

      sonuclar.push({ varyant_id: varyantId, mevcut, sayilan, fark });
    }

    await connection.commit();

    res.json({
      mesaj: sonuclar.length
        ? `${sonuclar.length} kalemde düzeltme yapıldı`
        : "Fark bulunamadı, stoklar zaten doğru",
      sonuclar,
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

module.exports = { kaydet };
