const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const { sayfa, limit } = req.query;

    const sayfaNo = parseInt(sayfa, 10) || 1;
    const limitSayi = Math.min(parseInt(limit, 10) || 50, 200);
    const offset = (sayfaNo - 1) * limitSayi;

    const [sayim] = await pool.query(
      "SELECT COUNT(*) AS toplam FROM transferler",
    );
    res.set("X-Toplam-Kayit", sayim[0].toplam);

    const [rows] = await pool.query(
      `SELECT t.id, t.varyant_id, t.kaynak_lokasyon_id, t.hedef_lokasyon_id,
              t.miktar, t.aciklama, t.tarih,
              u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg,
              kl.kod AS kaynak_kod, hl.kod AS hedef_kod,
              k.ad AS kullanici_adi
       FROM transferler t
       JOIN urun_varyantlari v ON t.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
       JOIN lokasyonlar kl ON t.kaynak_lokasyon_id = kl.id
       JOIN lokasyonlar hl ON t.hedef_lokasyon_id = hl.id
       LEFT JOIN kullanicilar k ON t.olusturan_kullanici_id = k.id
       ORDER BY t.tarih DESC
       LIMIT ? OFFSET ?`,
      [limitSayi, offset],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const olustur = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const {
      varyant_id,
      kaynak_lokasyon_id,
      hedef_lokasyon_id,
      miktar,
      aciklama,
    } = req.body;

    const tasinacak = Number(miktar);
    const kaynakId = Number(kaynak_lokasyon_id);
    const hedefId = Number(hedef_lokasyon_id);

    if (!varyant_id || !kaynakId || !hedefId) {
      return res
        .status(400)
        .json({ hata: "Varyant, kaynak ve hedef lokasyon zorunludur" });
    }

    if (!Number.isFinite(tasinacak) || tasinacak <= 0) {
      return res.status(400).json({ hata: "Miktar sıfırdan büyük olmalıdır" });
    }

    if (kaynakId === hedefId) {
      return res
        .status(400)
        .json({ hata: "Kaynak ve hedef lokasyon aynı olamaz" });
    }

    await connection.beginTransaction();

    const [lokasyonRows] = await connection.query(
      "SELECT id FROM lokasyonlar WHERE id IN (?, ?) AND aktif = TRUE",
      [kaynakId, hedefId],
    );

    if (lokasyonRows.length !== 2) {
      await connection.rollback();
      return res
        .status(404)
        .json({ hata: "Kaynak ya da hedef lokasyon bulunamadı" });
    }

    const [kilitliRows] = await connection.query(
      `SELECT lokasyon_id, miktar FROM varyant_lokasyon
       WHERE varyant_id = ? AND lokasyon_id IN (?, ?)
       ORDER BY lokasyon_id
       FOR UPDATE`,
      [varyant_id, kaynakId, hedefId],
    );

    const kaynakSatiri = kilitliRows.find(
      (r) => Number(r.lokasyon_id) === kaynakId,
    );
    const kaynaktaki = kaynakSatiri ? Number(kaynakSatiri.miktar) : 0;

    if (kaynaktaki < tasinacak) {
      await connection.rollback();
      return res.status(400).json({
        hata: `Kaynak lokasyonda yeterli stok yok (mevcut ${kaynaktaki.toFixed(0)})`,
      });
    }

    const [dususSonuc] = await connection.query(
      `UPDATE varyant_lokasyon SET miktar = miktar - ?
       WHERE varyant_id = ? AND lokasyon_id = ? AND miktar >= ?`,
      [tasinacak, varyant_id, kaynakId, tasinacak],
    );

    if (dususSonuc.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({
        hata: "Stok bu sırada değişmiş, transfer geri alındı. Tekrar deneyin.",
      });
    }

    await connection.query(
      `INSERT INTO varyant_lokasyon (varyant_id, lokasyon_id, miktar)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE miktar = miktar + ?`,
      [varyant_id, hedefId, tasinacak, tasinacak],
    );

    await connection.query(
      `INSERT INTO transferler
       (varyant_id, kaynak_lokasyon_id, hedef_lokasyon_id, miktar, aciklama, olusturan_kullanici_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        varyant_id,
        kaynakId,
        hedefId,
        tasinacak,
        aciklama || null,
        req.kullanici.id,
      ],
    );

    await connection.commit();

    res.status(201).json({ mesaj: "Transfer tamamlandı" });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

module.exports = { listele, olustur };
