const pool = require("../config/db");
const { reservedQuantity } = require("../utils/reservations");

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
    // Govde schemas/transfer.js tarafindan dogrulanip sayiya cevrildi:
    // birim_id ve hedef_lokasyon_id pozitif tam sayi, miktar varsa pozitif.
    const {
      birim_id: birimId,
      hedef_lokasyon_id: hedefId,
      miktar,
      aciklama,
    } = req.body;

    const [birimRows] = await connection.query(
      `SELECT id, tip, kod, varyant_id, lokasyon_id, miktar
       FROM stok_birimleri WHERE id = ?`,
      [birimId],
    );

    if (!birimRows.length) {
      return res.status(404).json({ hata: "Stok birimi bulunamadı" });
    }

    const birim = birimRows[0];
    const kaynakId = Number(birim.lokasyon_id);

    if (kaynakId === hedefId) {
      return res
        .status(400)
        .json({ hata: "Kaynak ve hedef lokasyon aynı olamaz" });
    }

    await connection.beginTransaction();

    const [hedefRows] = await connection.query(
      "SELECT id FROM lokasyonlar WHERE id = ? AND aktif = TRUE",
      [hedefId],
    );

    if (!hedefRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Hedef lokasyon bulunamadı" });
    }

    let tasinan;

    if (birim.tip === "palet") {
      const [kilitli] = await connection.query(
        "SELECT id, lokasyon_id, miktar FROM stok_birimleri WHERE id = ? FOR UPDATE",
        [birimId],
      );

      if (!kilitli.length) {
        await connection.rollback();
        return res.status(404).json({ hata: "Palet bulunamadı" });
      }

      tasinan = Number(kilitli[0].miktar);

      const [sonuc] = await connection.query(
        `UPDATE stok_birimleri SET lokasyon_id = ?
         WHERE id = ? AND lokasyon_id = ?`,
        [hedefId, birimId, kaynakId],
      );

      if (sonuc.affectedRows === 0) {
        await connection.rollback();
        return res.status(409).json({
          hata: "Palet bu sırada taşınmış, işlem geri alındı. Tekrar deneyin.",
        });
      }
    } else {
      // Sema miktari opsiyonel tutuyor, cunku palet tasimada arayuz bu alani
      // hic gondermiyor. Birimin dokme oldugu ancak veritabanindan
      // bilinebildigi icin zorunluluk kontrolu burada kaliyor. Degerin
      // pozitif oldugunu sema zaten garanti ediyor.
      if (miktar === undefined) {
        await connection.rollback();
        return res
          .status(400)
          .json({ hata: "Miktar sıfırdan büyük olmalıdır" });
      }

      tasinan = miktar;

      const [kilitliRows] = await connection.query(
        `SELECT lokasyon_id, miktar FROM stok_birimleri
         WHERE tip = 'dokme' AND varyant_id = ? AND lokasyon_id IN (?, ?)
         ORDER BY lokasyon_id
         FOR UPDATE`,
        [birim.varyant_id, kaynakId, hedefId],
      );

      const kaynakSatiri = kilitliRows.find(
        (r) => Number(r.lokasyon_id) === kaynakId,
      );
      const kaynaktaki = kaynakSatiri ? Number(kaynakSatiri.miktar) : 0;
      const rezerve = await reservedQuantity(connection, birim.id);
      const kullanilabilir = kaynaktaki - rezerve;

      if (kullanilabilir < tasinan) {
        await connection.rollback();
        return res.status(400).json({
          hata: `Kaynak lokasyonda yeterli serbest stok yok (mevcut ${kaynaktaki.toFixed(0)}, ${rezerve.toFixed(0)} adedi siparişlere ayrılmış)`,
        });
      }

      const [dususSonuc] = await connection.query(
        `UPDATE stok_birimleri SET miktar = miktar - ?
         WHERE tip = 'dokme' AND varyant_id = ? AND lokasyon_id = ?
           AND miktar >= ?`,
        [tasinan, birim.varyant_id, kaynakId, tasinan],
      );

      if (dususSonuc.affectedRows === 0) {
        await connection.rollback();
        return res.status(409).json({
          hata: "Stok bu sırada değişmiş, transfer geri alındı. Tekrar deneyin.",
        });
      }

      await connection.query(
        `DELETE FROM stok_birimleri
         WHERE tip = 'dokme' AND varyant_id = ? AND lokasyon_id = ? AND miktar = 0`,
        [birim.varyant_id, kaynakId],
      );

      await connection.query(
        `INSERT INTO stok_birimleri
         (tip, varyant_id, lokasyon_id, miktar, olusturan_kullanici_id)
         VALUES ('dokme', ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE miktar = miktar + ?`,
        [birim.varyant_id, hedefId, tasinan, req.kullanici.id, tasinan],
      );
    }

    const not =
      birim.tip === "palet"
        ? `${birim.kod} paleti taşındı${aciklama ? ` · ${aciklama}` : ""}`
        : aciklama || null;

    await connection.query(
      `INSERT INTO transferler
       (varyant_id, kaynak_lokasyon_id, hedef_lokasyon_id, miktar, aciklama, olusturan_kullanici_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [birim.varyant_id, kaynakId, hedefId, tasinan, not, req.kullanici.id],
    );

    await connection.commit();

    res.status(201).json({
      mesaj:
        birim.tip === "palet"
          ? `${birim.kod} paleti taşındı`
          : "Transfer tamamlandı",
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

module.exports = { listele, olustur };
