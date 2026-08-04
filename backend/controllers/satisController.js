const pool = require("../config/db");
const yuvarla = (sayi) => Math.round(sayi * 100) / 100;

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
    const { tahsisler } = req.body;

    if (!Array.isArray(tahsisler) || !tahsisler.length) {
      return res
        .status(400)
        .json({ hata: "Hangi birimlerden çıkılacağı seçilmelidir" });
    }

    const istekler = new Map();

    for (const tahsis of tahsisler) {
      const birimId = Number(tahsis.birim_id);
      const miktar = Number(tahsis.miktar);

      if (!Number.isInteger(birimId) || birimId <= 0) {
        return res.status(400).json({ hata: "Geçersiz stok birimi" });
      }
      if (!Number.isFinite(miktar) || miktar <= 0) {
        return res
          .status(400)
          .json({ hata: "Miktar sıfırdan büyük olmalıdır" });
      }
      if (istekler.has(birimId)) {
        return res.status(400).json({
          hata: `Aynı birim listede birden fazla kez var (id: ${birimId})`,
        });
      }

      istekler.set(birimId, miktar);
    }

    const birimIdleri = [...istekler.keys()].sort((a, b) => a - b);

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

    const gereken = new Map();

    for (const kalem of kalemler) {
      const onceki = gereken.get(kalem.varyant_id);
      if (onceki) {
        onceki.miktar = yuvarla(onceki.miktar + Number(kalem.miktar));
      } else {
        gereken.set(kalem.varyant_id, {
          miktar: yuvarla(Number(kalem.miktar)),
          urun_adi: kalem.urun_adi,
          boy: kalem.boy,
        });
      }
    }

    const [birimRows] = await connection.query(
      `SELECT id, tip, kod, varyant_id, lokasyon_id, miktar
       FROM stok_birimleri
       WHERE id IN (?)
       ORDER BY id
       FOR UPDATE`,
      [birimIdleri],
    );

    if (birimRows.length !== birimIdleri.length) {
      const bulunanlar = new Set(birimRows.map((b) => b.id));
      const eksik = birimIdleri.filter((bid) => !bulunanlar.has(bid));
      await connection.rollback();
      return res
        .status(404)
        .json({ hata: `Stok birimi bulunamadı (id: ${eksik.join(", ")})` });
    }

    const verilen = new Map();

    for (const birim of birimRows) {
      const istenen = istekler.get(birim.id);

      if (Number(birim.miktar) < istenen) {
        await connection.rollback();
        return res.status(400).json({
          hata: `${birim.kod || "Dökme"} biriminde yeterli stok yok (mevcut ${Number(birim.miktar).toFixed(0)}, istenen ${istenen.toFixed(0)})`,
        });
      }

      verilen.set(
        birim.varyant_id,
        yuvarla((verilen.get(birim.varyant_id) || 0) + istenen),
      );
    }

    for (const [varyantId, bilgi] of gereken) {
      const secilen = verilen.get(varyantId) || 0;
      if (secilen !== bilgi.miktar) {
        await connection.rollback();
        return res.status(400).json({
          hata: `${bilgi.urun_adi} (${bilgi.boy}) için seçilen miktar siparişle uyuşmuyor — sipariş ${bilgi.miktar.toFixed(0)}, seçilen ${secilen.toFixed(0)}`,
        });
      }
    }

    for (const varyantId of verilen.keys()) {
      if (!gereken.has(varyantId)) {
        await connection.rollback();
        return res
          .status(400)
          .json({ hata: "Siparişte olmayan bir ürün için birim seçilmiş" });
      }
    }

    for (const birim of birimRows) {
      const dusulecek = istekler.get(birim.id);

      const [dususSonuc] = await connection.query(
        `UPDATE stok_birimleri SET miktar = miktar - ?
         WHERE id = ? AND miktar >= ?`,
        [dusulecek, birim.id, dusulecek],
      );

      if (dususSonuc.affectedRows === 0) {
        await connection.rollback();
        return res.status(409).json({
          hata: "Stok bu sırada değişmiş, işlem geri alındı. Tekrar deneyin.",
        });
      }

      await connection.query(
        "DELETE FROM stok_birimleri WHERE id = ? AND miktar = 0",
        [birim.id],
      );

      await connection.query(
        "UPDATE urun_varyantlari SET miktar = miktar - ? WHERE id = ?",
        [dusulecek, birim.varyant_id],
      );

      await connection.query(
        `INSERT INTO stok_hareketleri
         (varyant_id, lokasyon_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
         VALUES (?, ?, 'cikis', 'satis', ?, ?, ?)`,
        [
          birim.varyant_id,
          birim.lokasyon_id,
          dusulecek,
          `Satış siparişi #${id} teslim edildi${birim.kod ? ` · ${birim.kod}` : ""}`,
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
      mesaj: `Sipariş teslim edildi, ${birimRows.length} birimden stok düşüldü`,
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
