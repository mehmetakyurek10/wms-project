const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const [siparisler] = await pool.query(
      `SELECT s.*, m.ad AS musteri_adi, m.telefon AS musteri_telefon,
              k.ad AS olusturan_adi
       FROM satis_siparisleri s
       JOIN musteriler m ON s.musteri_id = m.id
       LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
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
       FROM satis_siparis_kalemleri k
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
    const { musteri_id, kalemler } = req.body;

    if (!musteri_id || !kalemler || !kalemler.length) {
      connection.release();
      return res
        .status(400)
        .json({ hata: "Müşteri ve en az bir kalem gereklidir" });
    }

    const toplam_tutar = kalemler.reduce(
      (toplam, k) => toplam + k.miktar * k.birim_fiyat,
      0,
    );

    await connection.beginTransaction();

    const [siparisResult] = await connection.query(
      `INSERT INTO satis_siparisleri (musteri_id, durum, toplam_tutar, olusturan_kullanici_id)
       VALUES (?, 'beklemede', ?, ?)`,
      [musteri_id, toplam_tutar, req.kullanici.id],
    );
    const siparis_id = siparisResult.insertId;

    for (const kalem of kalemler) {
      await connection.query(
        `INSERT INTO satis_siparis_kalemleri (siparis_id, varyant_id, miktar, birim_fiyat)
         VALUES (?, ?, ?, ?)`,
        [siparis_id, kalem.varyant_id, kalem.miktar, kalem.birim_fiyat],
      );
    }

    await connection.commit();
    connection.release();

    res
      .status(201)
      .json({ id: siparis_id, mesaj: "Satış siparişi oluşturuldu" });
  } catch (err) {
    await connection.rollback();
    connection.release();
    next(err);
  }
};

const teslimEt = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;

    const [siparisRows] = await connection.query(
      "SELECT * FROM satis_siparisleri WHERE id = ?",
      [id],
    );

    if (!siparisRows.length) {
      connection.release();
      return res.status(404).json({ hata: "Sipariş bulunamadı" });
    }
    if (siparisRows[0].durum === "teslim_edildi") {
      connection.release();
      return res.status(400).json({ hata: "Bu sipariş zaten teslim edilmiş" });
    }
    if (siparisRows[0].durum === "iptal") {
      connection.release();
      return res
        .status(400)
        .json({ hata: "İptal edilmiş sipariş teslim edilemez" });
    }

    await connection.beginTransaction();

    const [kalemler] = await connection.query(
      `SELECT k.*, u.ad AS urun_adi, v.boy
       FROM satis_siparis_kalemleri k
       JOIN urun_varyantlari v ON k.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
       WHERE k.siparis_id = ?`,
      [id],
    );

    const tahsisPlani = [];

    for (const kalem of kalemler) {
      const [lokasyonStoklari] = await connection.query(
        `SELECT vl.lokasyon_id, vl.miktar, l.kod
         FROM varyant_lokasyon vl
         JOIN lokasyonlar l ON vl.lokasyon_id = l.id
         WHERE vl.varyant_id = ? AND vl.miktar > 0
         ORDER BY vl.miktar DESC
         FOR UPDATE`,
        [kalem.varyant_id],
      );

      const toplamMevcut = lokasyonStoklari.reduce(
        (toplam, satir) => toplam + Number(satir.miktar),
        0,
      );

      const gereken = Number(kalem.miktar);

      if (toplamMevcut < gereken) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          hata: `Yetersiz stok: ${kalem.urun_adi} (${kalem.boy}) — mevcut ${toplamMevcut.toFixed(0)}, gereken ${gereken.toFixed(0)}`,
        });
      }

      let kalan = gereken;

      for (const satir of lokasyonStoklari) {
        if (kalan <= 0) break;
        const alinacak = Math.min(kalan, Number(satir.miktar));
        tahsisPlani.push({
          varyant_id: kalem.varyant_id,
          lokasyon_id: satir.lokasyon_id,
          miktar: alinacak,
        });
        kalan -= alinacak;
      }
    }

    for (const tahsis of tahsisPlani) {
      await connection.query(
        `UPDATE varyant_lokasyon SET miktar = miktar - ?
         WHERE varyant_id = ? AND lokasyon_id = ?`,
        [tahsis.miktar, tahsis.varyant_id, tahsis.lokasyon_id],
      );

      await connection.query(
        "UPDATE urun_varyantlari SET miktar = miktar - ? WHERE id = ?",
        [tahsis.miktar, tahsis.varyant_id],
      );

      await connection.query(
        `INSERT INTO stok_hareketleri
         (varyant_id, lokasyon_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
         VALUES (?, ?, 'cikis', 'satis', ?, ?, ?)`,
        [
          tahsis.varyant_id,
          tahsis.lokasyon_id,
          tahsis.miktar,
          `Satış siparişi #${id} teslim edildi`,
          req.kullanici.id,
        ],
      );
    }

    await connection.query(
      "UPDATE satis_siparisleri SET durum = 'teslim_edildi', teslim_tarihi = NOW() WHERE id = ?",
      [id],
    );

    await connection.commit();
    connection.release();

    res.json({
      mesaj: `Sipariş teslim edildi, ${tahsisPlani.length} lokasyondan stok düşüldü`,
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    next(err);
  }
};

const iptalEt = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      "SELECT durum FROM satis_siparisleri WHERE id = ?",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ hata: "Sipariş bulunamadı" });
    }
    if (rows[0].durum === "teslim_edildi") {
      return res
        .status(400)
        .json({ hata: "Teslim edilmiş sipariş iptal edilemez" });
    }

    await pool.query(
      "UPDATE satis_siparisleri SET durum = 'iptal' WHERE id = ?",
      [id],
    );

    res.json({ mesaj: "Sipariş iptal edildi" });
  } catch (err) {
    next(err);
  }
};

module.exports = { listele, detay, olustur, teslimEt, iptalEt };
