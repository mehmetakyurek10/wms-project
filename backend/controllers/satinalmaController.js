const pool = require("../config/db");

const listele = async (req, res) => {
  try {
    const [siparisler] = await pool.query(
      `SELECT s.*, t.ad AS tedarikci_adi
       FROM satinalma_siparisleri s
       JOIN tedarikciler t ON s.tedarikci_id = t.id
       ORDER BY s.siparis_tarihi DESC`,
    );
    res.json(siparisler);
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const detay = async (req, res) => {
  try {
    const { id } = req.params;
    const [kalemler] = await pool.query(
      `SELECT k.*, u.ad AS urun_adi
       FROM satinalma_siparis_kalemleri k
       JOIN urunler u ON k.urun_id = u.id
       WHERE k.siparis_id = ?`,
      [id],
    );
    res.json(kalemler);
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const olustur = async (req, res) => {
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
      "INSERT INTO satinalma_siparisleri (tedarikci_id, durum, toplam_tutar) VALUES (?, 'beklemede', ?)",
      [tedarikci_id, toplam_tutar],
    );
    const siparis_id = siparisResult.insertId;

    for (const kalem of kalemler) {
      await pool.query(
        "INSERT INTO satinalma_siparis_kalemleri (siparis_id, urun_id, miktar, birim_fiyat) VALUES (?, ?, ?, ?)",
        [siparis_id, kalem.urun_id, kalem.miktar, kalem.birim_fiyat],
      );
    }

    res
      .status(201)
      .json({ id: siparis_id, mesaj: "Satınalma siparişi oluşturuldu" });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

const teslimAl = async (req, res) => {
  try {
    const { id } = req.params;

    const [siparisRows] = await pool.query(
      "SELECT * FROM satinalma_siparisleri WHERE id = ?",
      [id],
    );
    if (!siparisRows.length)
      return res.status(404).json({ hata: "Sipariş bulunamadı" });
    if (siparisRows[0].durum === "teslim_alindi") {
      return res.status(400).json({ hata: "Bu sipariş zaten teslim alınmış" });
    }

    const [kalemler] = await pool.query(
      "SELECT * FROM satinalma_siparis_kalemleri WHERE siparis_id = ?",
      [id],
    );

    for (const kalem of kalemler) {
      await pool.query("UPDATE urunler SET miktar = miktar + ? WHERE id = ?", [
        kalem.miktar,
        kalem.urun_id,
      ]);
      await pool.query(
        "INSERT INTO stok_hareketleri (urun_id, tip, miktar, aciklama) VALUES (?, 'giris', ?, ?)",
        [
          kalem.urun_id,
          kalem.miktar,
          `Satınalma siparişi #${id} teslim alındı`,
        ],
      );
    }

    await pool.query(
      "UPDATE satinalma_siparisleri SET durum = 'teslim_alindi', teslim_tarihi = NOW() WHERE id = ?",
      [id],
    );

    res.json({ mesaj: "Sipariş teslim alındı, stoklar güncellendi" });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

module.exports = { listele, detay, olustur, teslimAl };
