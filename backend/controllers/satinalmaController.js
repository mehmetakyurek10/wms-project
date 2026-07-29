const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const [siparisler] = await pool.query(
      `SELECT s.*, t.ad AS tedarikci_adi, t.telefon AS tedarikci_telefon
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
      `SELECT k.*, u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg
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
  try {
    const { tedarikci_id, kalemler } = req.body;

    if (!kalemler || !kalemler.length) {
      return res.status(400).json({ hata: "En az bir kalem eklemelisiniz" });
    }

    const toplam_tutar = kalemler.reduce(
      (toplam, k) => toplam + k.miktar * k.birim_fiyat,
      0,
    );

    const [siparisResult] = await pool.query(
      "INSERT INTO satinalma_siparisleri (tedarikci_id, durum, toplam_tutar, olusturan_kullanici_id) VALUES (?, 'beklemede', ?, ?)",
      [tedarikci_id, toplam_tutar, req.kullanici.id],
    );
    const siparis_id = siparisResult.insertId;

    for (const kalem of kalemler) {
      await pool.query(
        "INSERT INTO satinalma_siparis_kalemleri (siparis_id, varyant_id, miktar, birim_fiyat) VALUES (?, ?, ?, ?)",
        [siparis_id, kalem.varyant_id, kalem.miktar, kalem.birim_fiyat],
      );
    }

    res
      .status(201)
      .json({ id: siparis_id, mesaj: "Satınalma siparişi oluşturuldu" });
  } catch (err) {
    next(err);
  }
};

const teslimAl = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;

    const [siparisRows] = await connection.query(
      "SELECT * FROM satinalma_siparisleri WHERE id = ?",
      [id],
    );
    if (!siparisRows.length) {
      connection.release();
      return res.status(404).json({ hata: "Sipariş bulunamadı" });
    }
    if (siparisRows[0].durum === "teslim_alindi") {
      connection.release();
      return res.status(400).json({ hata: "Bu sipariş zaten teslim alınmış" });
    }

    await connection.beginTransaction();

    const [kalemler] = await connection.query(
      "SELECT * FROM satinalma_siparis_kalemleri WHERE siparis_id = ?",
      [id],
    );

    for (const kalem of kalemler) {
      await connection.query(
        "UPDATE urun_varyantlari SET miktar = miktar + ? WHERE id = ?",
        [kalem.miktar, kalem.varyant_id],
      );
      await connection.query(
        `INSERT INTO stok_hareketleri
         (varyant_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
         VALUES (?, 'giris', 'satinalma', ?, ?, ?)`,
        [
          kalem.varyant_id,
          kalem.miktar,
          `Satınalma siparişi #${id} teslim alındı`,
          req.kullanici.id,
        ],
      );
    }

    await connection.query(
      "UPDATE satinalma_siparisleri SET durum = 'teslim_alindi', teslim_tarihi = NOW() WHERE id = ?",
      [id],
    );

    await connection.commit();
    connection.release();

    res.json({ mesaj: "Sipariş teslim alındı, stoklar güncellendi" });
  } catch (err) {
    await connection.rollback();
    connection.release();
    next(err);
  }
};

module.exports = { listele, detay, olustur, teslimAl };
