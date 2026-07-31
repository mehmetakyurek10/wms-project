const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const [siparisler] = await pool.query(
      `SELECT s.id, s.durum, s.siparis_tarihi, s.teslim_tarihi, s.toplam_tutar,
              m.ad AS musteri_adi, m.telefon AS musteri_telefon,
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
      `SELECT k.id, k.miktar, k.birim_fiyat, k.varyant_id,
              u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg
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

    if (!musteri_id) {
      return res.status(400).json({ hata: "Müşteri seçilmelidir" });
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

    const [musteriRows] = await connection.query(
      "SELECT id FROM musteriler WHERE id = ?",
      [musteri_id],
    );

    if (!musteriRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Müşteri bulunamadı" });
    }

    const toplam_tutar = kalemler.reduce(
      (toplam, k) => toplam + Number(k.miktar) * Number(k.birim_fiyat),
      0,
    );

    const [siparisResult] = await connection.query(
      `INSERT INTO satis_siparisleri
       (musteri_id, durum, toplam_tutar, olusturan_kullanici_id)
       VALUES (?, 'beklemede', ?, ?)`,
      [musteri_id, toplam_tutar, req.kullanici.id],
    );
    const siparis_id = siparisResult.insertId;

    const kalemSatirlari = kalemler.map((k) => [
      siparis_id,
      k.varyant_id,
      Number(k.miktar),
      Number(k.birim_fiyat),
    ]);

    await connection.query(
      `INSERT INTO satis_siparis_kalemleri
       (siparis_id, varyant_id, miktar, birim_fiyat)
       VALUES ?`,
      [kalemSatirlari],
    );

    await connection.commit();

    res
      .status(201)
      .json({ id: siparis_id, mesaj: "Satış siparişi oluşturuldu" });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

const teslimEt = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;

    await connection.beginTransaction();

    const [siparisRows] = await connection.query(
      "SELECT id, durum FROM satis_siparisleri WHERE id = ? FOR UPDATE",
      [id],
    );

    if (!siparisRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Sipariş bulunamadı" });
    }
    if (siparisRows[0].durum === "teslim_edildi") {
      await connection.rollback();
      return res.status(400).json({ hata: "Bu sipariş zaten teslim edilmiş" });
    }
    if (siparisRows[0].durum === "iptal") {
      await connection.rollback();
      return res
        .status(400)
        .json({ hata: "İptal edilmiş sipariş teslim edilemez" });
    }

    const [kalemler] = await connection.query(
      `SELECT k.varyant_id, k.miktar, u.ad AS urun_adi, v.boy
       FROM satis_siparis_kalemleri k
       JOIN urun_varyantlari v ON k.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
       WHERE k.siparis_id = ?`,
      [id],
    );

    const varyantIhtiyaci = new Map();

    for (const kalem of kalemler) {
      const mevcut = varyantIhtiyaci.get(kalem.varyant_id);
      if (mevcut) {
        mevcut.gereken += Number(kalem.miktar);
      } else {
        varyantIhtiyaci.set(kalem.varyant_id, {
          varyant_id: kalem.varyant_id,
          urun_adi: kalem.urun_adi,
          boy: kalem.boy,
          gereken: Number(kalem.miktar),
        });
      }
    }

    const sirali = [...varyantIhtiyaci.values()].sort(
      (a, b) => a.varyant_id - b.varyant_id,
    );

    const tahsisPlani = [];

    for (const ihtiyac of sirali) {
      const [lokasyonStoklari] = await connection.query(
        `SELECT vl.lokasyon_id, vl.miktar
         FROM varyant_lokasyon vl
         WHERE vl.varyant_id = ? AND vl.miktar > 0
         ORDER BY vl.lokasyon_id
         FOR UPDATE`,
        [ihtiyac.varyant_id],
      );

      const toplamMevcut = lokasyonStoklari.reduce(
        (toplam, satir) => toplam + Number(satir.miktar),
        0,
      );

      if (toplamMevcut < ihtiyac.gereken) {
        await connection.rollback();
        return res.status(400).json({
          hata: `Yetersiz stok: ${ihtiyac.urun_adi} (${ihtiyac.boy}) — mevcut ${toplamMevcut.toFixed(0)}, gereken ${ihtiyac.gereken.toFixed(0)}`,
        });
      }

      const tahsisSirasi = [...lokasyonStoklari].sort(
        (a, b) => Number(b.miktar) - Number(a.miktar),
      );

      let kalan = ihtiyac.gereken;

      for (const satir of tahsisSirasi) {
        if (kalan <= 0) break;
        const alinacak = Math.min(kalan, Number(satir.miktar));
        tahsisPlani.push({
          varyant_id: ihtiyac.varyant_id,
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

    const [durumSonuc] = await connection.query(
      `UPDATE satis_siparisleri
       SET durum = 'teslim_edildi', teslim_tarihi = NOW()
       WHERE id = ? AND durum = 'beklemede'`,
      [id],
    );

    if (durumSonuc.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({
        hata: "Sipariş başka bir işlem tarafından güncellenmiş",
      });
    }

    await connection.commit();

    res.json({
      mesaj: `Sipariş teslim edildi, ${tahsisPlani.length} lokasyondan stok düşüldü`,
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

const iptalEt = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [sonuc] = await pool.query(
      "UPDATE satis_siparisleri SET durum = 'iptal' WHERE id = ? AND durum = 'beklemede'",
      [id],
    );

    if (sonuc.affectedRows === 0) {
      const [rows] = await pool.query(
        "SELECT durum FROM satis_siparisleri WHERE id = ?",
        [id],
      );

      if (!rows.length) {
        return res.status(404).json({ hata: "Sipariş bulunamadı" });
      }

      return res.status(400).json({
        hata: `Bu sipariş iptal edilemez (durum: ${rows[0].durum})`,
      });
    }

    res.json({ mesaj: "Sipariş iptal edildi" });
  } catch (err) {
    next(err);
  }
};

module.exports = { listele, detay, olustur, teslimEt, iptalEt };
