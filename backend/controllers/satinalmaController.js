const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const [siparisler] = await pool.query(
      `SELECT s.id, s.durum, s.siparis_tarihi, s.teslim_tarihi, s.toplam_tutar,
              t.ad AS tedarikci_adi, t.telefon AS tedarikci_telefon
       FROM satinalma_siparisleri s
       JOIN tedarikciler t ON s.tedarikci_id = t.id
       ORDER BY s.siparis_tarihi DESC`,
    );
    res.json(siparisler);
  } catch (err) {
    next(err);
  }
};

const detay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [kalemler] = await pool.query(
      `SELECT k.id, k.miktar, k.birim_fiyat, k.varyant_id,
              u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg
       FROM satinalma_siparis_kalemleri k
       JOIN urun_varyantlari v ON k.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
       WHERE k.siparis_id = ?`,
      [id],
    );
    res.json(kalemler);
  } catch (err) {
    next(err);
  }
};

const olustur = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { tedarikci_id, kalemler } = req.body;

    if (!tedarikci_id) {
      return res.status(400).json({ hata: "Tedarikçi seçilmelidir" });
    }

    if (!Array.isArray(kalemler) || kalemler.length === 0) {
      return res.status(400).json({ hata: "En az bir kalem eklemelisiniz" });
    }

    for (const kalem of kalemler) {
      const miktar = Number(kalem.miktar);
      const fiyat = Number(kalem.birim_fiyat);

      if (!kalem.varyant_id) {
        return res
          .status(400)
          .json({ hata: "Her kalemde varyant seçilmelidir" });
      }
      if (!Number.isFinite(miktar) || miktar <= 0) {
        return res
          .status(400)
          .json({ hata: "Miktar sıfırdan büyük olmalıdır" });
      }
      if (!Number.isFinite(fiyat) || fiyat < 0) {
        return res.status(400).json({ hata: "Birim fiyat geçersiz" });
      }
    }

    await connection.beginTransaction();

    const [tedarikciRows] = await connection.query(
      "SELECT id FROM tedarikciler WHERE id = ?",
      [tedarikci_id],
    );

    if (!tedarikciRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Tedarikçi bulunamadı" });
    }

    const toplam_tutar = kalemler.reduce(
      (toplam, k) => toplam + Number(k.miktar) * Number(k.birim_fiyat),
      0,
    );

    const [siparisResult] = await connection.query(
      `INSERT INTO satinalma_siparisleri
       (tedarikci_id, durum, toplam_tutar, olusturan_kullanici_id)
       VALUES (?, 'beklemede', ?, ?)`,
      [tedarikci_id, toplam_tutar, req.kullanici.id],
    );
    const siparis_id = siparisResult.insertId;

    const kalemSatirlari = kalemler.map((k) => [
      siparis_id,
      k.varyant_id,
      Number(k.miktar),
      Number(k.birim_fiyat),
    ]);

    await connection.query(
      `INSERT INTO satinalma_siparis_kalemleri
       (siparis_id, varyant_id, miktar, birim_fiyat)
       VALUES ?`,
      [kalemSatirlari],
    );

    await connection.commit();

    res
      .status(201)
      .json({ id: siparis_id, mesaj: "Satınalma siparişi oluşturuldu" });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

const teslimAl = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { lokasyon_id } = req.body;

    if (!lokasyon_id) {
      return res
        .status(400)
        .json({ hata: "Malın indirileceği lokasyon seçilmelidir" });
    }

    await connection.beginTransaction();

    const [siparisRows] = await connection.query(
      "SELECT id, durum FROM satinalma_siparisleri WHERE id = ? FOR UPDATE",
      [id],
    );

    if (!siparisRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Sipariş bulunamadı" });
    }
    if (siparisRows[0].durum === "teslim_alindi") {
      await connection.rollback();
      return res.status(400).json({ hata: "Bu sipariş zaten teslim alınmış" });
    }
    if (siparisRows[0].durum === "iptal") {
      await connection.rollback();
      return res
        .status(400)
        .json({ hata: "İptal edilmiş sipariş teslim alınamaz" });
    }

    const [lokasyonRows] = await connection.query(
      "SELECT id FROM lokasyonlar WHERE id = ? AND aktif = TRUE",
      [lokasyon_id],
    );

    if (!lokasyonRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Lokasyon bulunamadı" });
    }

    const [kalemler] = await connection.query(
      "SELECT * FROM satinalma_siparis_kalemleri WHERE siparis_id = ? ORDER BY varyant_id",
      [id],
    );

    for (const kalem of kalemler) {
      await connection.query(
        "UPDATE urun_varyantlari SET miktar = miktar + ? WHERE id = ?",
        [kalem.miktar, kalem.varyant_id],
      );

      await connection.query(
        `INSERT INTO varyant_lokasyon (varyant_id, lokasyon_id, miktar)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE miktar = miktar + ?`,
        [kalem.varyant_id, lokasyon_id, kalem.miktar, kalem.miktar],
      );

      await connection.query(
        `INSERT INTO stok_hareketleri
         (varyant_id, lokasyon_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
         VALUES (?, ?, 'giris', 'satinalma', ?, ?, ?)`,
        [
          kalem.varyant_id,
          lokasyon_id,
          kalem.miktar,
          `Satınalma siparişi #${id} teslim alındı`,
          req.kullanici.id,
        ],
      );
    }

    const [durumSonuc] = await connection.query(
      `UPDATE satinalma_siparisleri
       SET durum = 'teslim_alindi', teslim_tarihi = NOW()
       WHERE id = ? AND durum <> 'teslim_alindi'`,
      [id],
    );

    if (durumSonuc.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({
        hata: "Sipariş başka bir işlem tarafından teslim alınmış",
      });
    }

    await connection.commit();

    res.json({ mesaj: "Sipariş teslim alındı, stoklar güncellendi" });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

module.exports = { listele, detay, olustur, teslimAl };
