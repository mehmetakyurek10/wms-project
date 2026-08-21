const pool = require("../config/db");
const { buildPagination } = require("../utils/pagination");
const yuvarla = (sayi) => Math.round(sayi * 100) / 100;

const listele = async (req, res, next) => {
  try {
    const { limit, offset } = buildPagination(req.query);

    const [sayim] = await pool.query(
      "SELECT COUNT(*) AS toplam FROM satis_siparisleri",
    );
    res.set("X-Toplam-Kayit", sayim[0].toplam);

    const [siparisler] = await pool.query(
      `SELECT s.id, s.durum, s.siparis_tarihi, s.teslim_tarihi, s.toplam_tutar,
              m.ad AS musteri_adi, m.telefon AS musteri_telefon,
              k.ad AS olusturan_adi
       FROM satis_siparisleri s
       JOIN musteriler m ON s.musteri_id = m.id
       LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
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

const rezervasyonlar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT r.id, r.birim_id, r.miktar,
              sb.tip, sb.kod, sb.miktar AS birim_miktari,
              l.kod AS lokasyon_kod,
              u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg
       FROM stok_rezervasyonlari r
       JOIN stok_birimleri sb ON r.birim_id = sb.id
       JOIN lokasyonlar l ON sb.lokasyon_id = l.id
       JOIN urun_varyantlari v ON sb.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
       WHERE r.siparis_id = ?
       ORDER BY u.ad, sb.kod`,
      [id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const olustur = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    // Govde schemas/sales.js tarafindan dogrulanip sayiya cevrildi:
    // musteri_id pozitif tam sayi, kalemler ve tahsisler bos olmayan diziler,
    // her kalemde varyant_id pozitif tam sayi, miktar pozitif, birim_fiyat
    // negatif degil, her tahsiste birim_id pozitif tam sayi ve miktar pozitif.
    const { musteri_id, kalemler, tahsisler } = req.body;

    const istekler = new Map();

    // Ayni birimin listede iki kez bulunmasi kalemler arasi bir kural;
    // tek bir tahsise bakarak anlasilamadigi icin semada degil burada.
    for (const tahsis of tahsisler) {
      if (istekler.has(tahsis.birim_id)) {
        return res.status(400).json({
          hata: `Aynı birim listede birden fazla kez var (id: ${tahsis.birim_id})`,
        });
      }

      istekler.set(tahsis.birim_id, tahsis.miktar);
    }

    const birimIdleri = [...istekler.keys()].sort((a, b) => a - b);

    await connection.beginTransaction();

    const [musteriRows] = await connection.query(
      "SELECT id FROM musteriler WHERE id = ?",
      [musteri_id],
    );

    if (!musteriRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Müşteri bulunamadı" });
    }

    // Fiyat denetimi icin varyantlari okumak gerekiyor; bu ayni zamanda
    // gecersiz bir varyant_id'nin yabanci anahtar hatasiyla 500 donmesini
    // engelleyip anlamli bir 404'e cevriyor.
    const varyantIdleri = [...new Set(kalemler.map((k) => k.varyant_id))].sort(
      (a, b) => a - b,
    );

    const [varyantRows] = await connection.query(
      `SELECT v.id, v.ambalaj_kg, v.boy, v.ambalaj_tipi,
              u.ad AS urun_adi
       FROM urun_varyantlari v
       JOIN urunler u ON u.id = v.urun_id
       WHERE v.id IN (?)`,
      [varyantIdleri],
    );

    if (varyantRows.length !== varyantIdleri.length) {
      const bulunanlar = new Set(varyantRows.map((v) => v.id));
      const eksik = varyantIdleri.filter((vid) => !bulunanlar.has(vid));
      await connection.rollback();
      return res
        .status(404)
        .json({ hata: `Ürün bulunamadı (id: ${eksik.join(", ")})` });
    }

    const [birimRows] = await connection.query(
      `SELECT id, tip, kod, varyant_id, miktar
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

    const [rezervasyonRows] = await connection.query(
      `SELECT birim_id, COALESCE(SUM(miktar), 0) AS rezerve
       FROM stok_rezervasyonlari
       WHERE birim_id IN (?)
       GROUP BY birim_id`,
      [birimIdleri],
    );

    const rezerveHaritasi = new Map(
      rezervasyonRows.map((r) => [r.birim_id, Number(r.rezerve)]),
    );

    const ayrilan = new Map();

    for (const birim of birimRows) {
      const istenen = istekler.get(birim.id);
      const rezerve = rezerveHaritasi.get(birim.id) || 0;
      const kullanilabilir = yuvarla(Number(birim.miktar) - rezerve);

      if (kullanilabilir < istenen) {
        await connection.rollback();
        return res.status(400).json({
          hata: `${birim.kod || "Dökme"} biriminde yeterli kullanılabilir stok yok (kullanılabilir ${kullanilabilir.toFixed(0)}, istenen ${istenen.toFixed(0)})`,
        });
      }

      ayrilan.set(
        birim.varyant_id,
        yuvarla((ayrilan.get(birim.varyant_id) || 0) + istenen),
      );
    }

    const gereken = new Map();

    for (const kalem of kalemler) {
      gereken.set(
        kalem.varyant_id,
        yuvarla((gereken.get(kalem.varyant_id) || 0) + kalem.miktar),
      );
    }

    for (const [varyantId, miktar] of gereken) {
      const secilen = ayrilan.get(varyantId) || 0;
      if (secilen !== miktar) {
        await connection.rollback();
        return res.status(400).json({
          hata: `Varyant ${varyantId} için ayrılan miktar siparişle uyuşmuyor — sipariş ${miktar.toFixed(0)}, ayrılan ${secilen.toFixed(0)}`,
        });
      }
    }

    for (const varyantId of ayrilan.keys()) {
      if (!gereken.has(varyantId)) {
        await connection.rollback();
        return res
          .status(400)
          .json({ hata: "Siparişte olmayan bir ürün için birim seçilmiş" });
      }
    }

    const toplam_tutar = kalemler.reduce(
      (toplam, k) => toplam + k.miktar * k.birim_fiyat,
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
      k.miktar,
      k.birim_fiyat,
    ]);

    await connection.query(
      `INSERT INTO satis_siparis_kalemleri
       (siparis_id, varyant_id, miktar, birim_fiyat)
       VALUES ?`,
      [kalemSatirlari],
    );

    const rezervasyonSatirlari = birimIdleri.map((birimId) => [
      siparis_id,
      birimId,
      istekler.get(birimId),
      req.kullanici.id,
    ]);

    await connection.query(
      `INSERT INTO stok_rezervasyonlari
       (siparis_id, birim_id, miktar, olusturan_kullanici_id)
       VALUES ?`,
      [rezervasyonSatirlari],
    );

    await connection.commit();

    res.status(201).json({
      id: siparis_id,
      mesaj: "Satış siparişi oluşturuldu, stok ayrıldı",
    });
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

    const [rezervasyonlar] = await connection.query(
      `SELECT id, birim_id, miktar
       FROM stok_rezervasyonlari
       WHERE siparis_id = ?
       ORDER BY birim_id`,
      [id],
    );

    if (!rezervasyonlar.length) {
      await connection.rollback();
      return res.status(400).json({
        hata: "Bu siparişte ayrılmış stok yok, teslim edilemez",
      });
    }

    const birimIdleri = rezervasyonlar
      .map((r) => r.birim_id)
      .sort((a, b) => a - b);

    const [birimRows] = await connection.query(
      `SELECT id, tip, kod, varyant_id, lokasyon_id, miktar
       FROM stok_birimleri
       WHERE id IN (?)
       ORDER BY id
       FOR UPDATE`,
      [birimIdleri],
    );

    const birimHaritasi = new Map(birimRows.map((b) => [b.id, b]));

    for (const rez of rezervasyonlar) {
      const birim = birimHaritasi.get(rez.birim_id);

      if (!birim) {
        await connection.rollback();
        return res.status(409).json({
          hata: "Ayrılan stok birimi artık depoda yok, sipariş gözden geçirilmeli",
        });
      }

      if (Number(birim.miktar) < Number(rez.miktar)) {
        await connection.rollback();
        return res.status(409).json({
          hata: `${birim.kod || "Dökme"} biriminde ayrılan miktar yok — ayrılan ${Number(rez.miktar).toFixed(0)}, mevcut ${Number(birim.miktar).toFixed(0)}. Sayım sonrası stok düşmüş olabilir.`,
        });
      }
    }

    // Asagidaki islemler birim sayisindan bagimsiz olarak sabit sayida
    // sorgu kullaniyor. Onceki halinde her birim icin bes ayri sorgu
    // calisiyordu; kilitlenen satirlar transaction boyunca acik kaldigi
    // icin bu sure es zamanli teslimatlarin birbirini bekleme olasiligini
    // artiriyordu. satinalmaController.teslimAl ayni kalibi kullaniyor.
    const dususCase = rezervasyonlar.map(() => "WHEN ? THEN ?").join(" ");
    const dususDegerleri = [];
    for (const rez of rezervasyonlar) {
      dususDegerleri.push(rez.birim_id, Number(rez.miktar));
    }

    const [dususSonuc] = await connection.query(
      `UPDATE stok_birimleri
       SET miktar = miktar - CASE id ${dususCase} ELSE 0 END
       WHERE id IN (?)
         AND miktar >= CASE id ${dususCase} ELSE 0 END`,
      [...dususDegerleri, birimIdleri, ...dususDegerleri],
    );

    if (dususSonuc.affectedRows !== rezervasyonlar.length) {
      await connection.rollback();
      return res.status(409).json({
        hata: "Stok bu sırada değişmiş, işlem geri alındı. Tekrar deneyin.",
      });
    }

    await connection.query(
      "DELETE FROM stok_rezervasyonlari WHERE siparis_id = ?",
      [id],
    );

    await connection.query(
      "DELETE FROM stok_birimleri WHERE id IN (?) AND miktar = 0",
      [birimIdleri],
    );

    // Ayni varyanttan birden fazla birim teslim ediliyor olabilir; tek bir
    // UPDATE yazabilmek icin dusumler varyant bazinda toplaniyor.
    const varyantDusumleri = new Map();

    for (const rez of rezervasyonlar) {
      const birim = birimHaritasi.get(rez.birim_id);
      varyantDusumleri.set(
        birim.varyant_id,
        yuvarla(
          (varyantDusumleri.get(birim.varyant_id) || 0) + Number(rez.miktar),
        ),
      );
    }

    const varyantIdleri = [...varyantDusumleri.keys()].sort((a, b) => a - b);
    const varyantCase = varyantIdleri.map(() => "WHEN ? THEN ?").join(" ");
    const varyantDegerleri = [];
    for (const varyantId of varyantIdleri) {
      varyantDegerleri.push(varyantId, varyantDusumleri.get(varyantId));
    }

    await connection.query(
      `UPDATE urun_varyantlari
       SET miktar = miktar - CASE id ${varyantCase} ELSE 0 END
       WHERE id IN (?)`,
      [...varyantDegerleri, varyantIdleri],
    );

    const hareketSatirlari = rezervasyonlar.map((rez) => {
      const birim = birimHaritasi.get(rez.birim_id);
      return [
        birim.varyant_id,
        birim.lokasyon_id,
        "cikis",
        "satis",
        Number(rez.miktar),
        `Satış siparişi #${id} teslim edildi${birim.kod ? ` · ${birim.kod}` : ""}`,
        req.kullanici.id,
      ];
    });

    await connection.query(
      `INSERT INTO stok_hareketleri
       (varyant_id, lokasyon_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
       VALUES ?`,
      [hareketSatirlari],
    );

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
      mesaj: `Sipariş teslim edildi, ${rezervasyonlar.length} birimden stok düşüldü`,
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

const iptalEt = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;

    await connection.beginTransaction();

    const [durumSonuc] = await connection.query(
      `UPDATE satis_siparisleri SET durum = 'iptal'
       WHERE id = ? AND durum = 'beklemede'`,
      [id],
    );

    if (durumSonuc.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({
        hata: "Yalnızca bekleyen siparişler iptal edilebilir",
      });
    }

    const [rezSonuc] = await connection.query(
      "DELETE FROM stok_rezervasyonlari WHERE siparis_id = ?",
      [id],
    );

    await connection.commit();

    res.json({
      mesaj: `Sipariş iptal edildi, ${rezSonuc.affectedRows} birimdeki ayrılan stok serbest bırakıldı`,
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

module.exports = { listele, detay, olustur, teslimEt, iptalEt, rezervasyonlar };
