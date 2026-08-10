const pool = require("../config/db");
const { buildPagination } = require("../utils/pagination");

const listele = async (req, res, next) => {
  try {
    const { limit, offset } = buildPagination(req.query);

    const kosul =
      req.query.bekleyen === "1"
        ? " WHERE s.durum NOT IN ('teslim_alindi','iptal')"
        : "";

    const [sayim] = await pool.query(
      `SELECT COUNT(*) AS toplam FROM satinalma_siparisleri s${kosul}`,
    );
    res.set("X-Toplam-Kayit", sayim[0].toplam);

    const [siparisler] = await pool.query(
      `SELECT s.id, s.durum, s.siparis_tarihi, s.teslim_tarihi, s.toplam_tutar,
              t.ad AS tedarikci_adi, t.telefon AS tedarikci_telefon
       FROM satinalma_siparisleri s
       JOIN tedarikciler t ON s.tedarikci_id = t.id${kosul}
       ORDER BY s.siparis_tarihi DESC, s.id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
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
    // Govde schemas/purchasing.js tarafindan dogrulanip sayiya cevrildi:
    // tedarikci_id pozitif tam sayi, kalemler bos olmayan dizi, her kalemde
    // varyant_id pozitif tam sayi, miktar pozitif, birim_fiyat negatif degil.
    const { tedarikci_id, kalemler } = req.body;

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
      (toplam, k) => toplam + k.miktar * k.birim_fiyat,
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
      k.miktar,
      k.birim_fiyat,
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
    // lokasyon_id schemas/purchasing.js tarafindan pozitif tam sayi olarak
    // dogrulandi.
    const { lokasyon_id } = req.body;

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
      `SELECT varyant_id, miktar FROM satinalma_siparis_kalemleri
       WHERE siparis_id = ? ORDER BY varyant_id`,
      [id],
    );

    if (!kalemler.length) {
      await connection.rollback();
      return res.status(400).json({ hata: "Bu siparişte kalem yok" });
    }

    const varyantToplamlari = new Map();

    for (const kalem of kalemler) {
      const onceki = varyantToplamlari.get(kalem.varyant_id) || 0;
      varyantToplamlari.set(
        kalem.varyant_id,
        Math.round((onceki + Number(kalem.miktar)) * 100) / 100,
      );
    }

    const varyantIdleri = [...varyantToplamlari.keys()].sort((a, b) => a - b);

    const caseParcalari = varyantIdleri.map(() => "WHEN ? THEN ?").join(" ");
    const caseDegerleri = [];
    for (const varyantId of varyantIdleri) {
      caseDegerleri.push(varyantId, varyantToplamlari.get(varyantId));
    }

    await connection.query(
      `UPDATE urun_varyantlari
       SET miktar = miktar + CASE id ${caseParcalari} ELSE 0 END
       WHERE id IN (?)`,
      [...caseDegerleri, varyantIdleri],
    );

    const birimSatirlari = varyantIdleri.map((varyantId) => [
      "dokme",
      varyantId,
      lokasyon_id,
      varyantToplamlari.get(varyantId),
      req.kullanici.id,
    ]);

    await connection.query(
      `INSERT INTO stok_birimleri
       (tip, varyant_id, lokasyon_id, miktar, olusturan_kullanici_id)
       VALUES ?
       AS yeni
       ON DUPLICATE KEY UPDATE miktar = stok_birimleri.miktar + yeni.miktar`,
      [birimSatirlari],
    );

    const hareketSatirlari = kalemler.map((kalem) => [
      kalem.varyant_id,
      lokasyon_id,
      "giris",
      "satinalma",
      Number(kalem.miktar),
      `Satınalma siparişi #${id} teslim alındı`,
      req.kullanici.id,
    ]);

    await connection.query(
      `INSERT INTO stok_hareketleri
       (varyant_id, lokasyon_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
       VALUES ?`,
      [hareketSatirlari],
    );

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
