const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*,
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
       LIMIT 100`,
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

    if (!varyant_id || !kaynak_lokasyon_id || !hedef_lokasyon_id) {
      connection.release();
      return res
        .status(400)
        .json({ hata: "Varyant, kaynak ve hedef lokasyon zorunludur" });
    }

    if (Number.isNaN(tasinacak) || tasinacak <= 0) {
      connection.release();
      return res.status(400).json({ hata: "Miktar sıfırdan büyük olmalıdır" });
    }

    if (Number(kaynak_lokasyon_id) === Number(hedef_lokasyon_id)) {
      connection.release();
      return res
        .status(400)
        .json({ hata: "Kaynak ve hedef lokasyon aynı olamaz" });
    }

    await connection.beginTransaction();

    const [kaynakRows] = await connection.query(
      `SELECT miktar FROM varyant_lokasyon
       WHERE varyant_id = ? AND lokasyon_id = ? FOR UPDATE`,
      [varyant_id, kaynak_lokasyon_id],
    );

    if (!kaynakRows.length || Number(kaynakRows[0].miktar) < tasinacak) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        hata: `Kaynak lokasyonda yeterli stok yok (mevcut ${
          kaynakRows.length ? Number(kaynakRows[0].miktar).toFixed(0) : 0
        })`,
      });
    }

    await connection.query(
      `UPDATE varyant_lokasyon SET miktar = miktar - ?
       WHERE varyant_id = ? AND lokasyon_id = ?`,
      [tasinacak, varyant_id, kaynak_lokasyon_id],
    );

    await connection.query(
      `INSERT INTO varyant_lokasyon (varyant_id, lokasyon_id, miktar)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE miktar = miktar + ?`,
      [varyant_id, hedef_lokasyon_id, tasinacak, tasinacak],
    );

    await connection.query(
      `INSERT INTO transferler
       (varyant_id, kaynak_lokasyon_id, hedef_lokasyon_id, miktar, aciklama, olusturan_kullanici_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        varyant_id,
        kaynak_lokasyon_id,
        hedef_lokasyon_id,
        tasinacak,
        aciklama || null,
        req.kullanici.id,
      ],
    );

    await connection.commit();
    connection.release();

    res.status(201).json({ mesaj: "Transfer tamamlandı" });
  } catch (err) {
    await connection.rollback();
    connection.release();
    next(err);
  }
};

module.exports = { listele, olustur };
