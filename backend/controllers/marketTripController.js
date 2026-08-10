const pool = require("../config/db");
const { buildPagination } = require("../utils/pagination");
const { yerelTarih } = require("../utils/tarih");

const yuvarla = (sayi) => Math.round(sayi * 100) / 100;

const listele = async (req, res, next) => {
  try {
    const { limit, offset } = buildPagination(req.query);
    const kosul = req.query.durum === "yolda" ? " WHERE s.durum = 'yolda'" : "";

    const [sayim] = await pool.query(
      `SELECT COUNT(*) AS toplam FROM pazar_seferleri s${kosul}`,
    );
    res.set("X-Toplam-Kayit", sayim[0].toplam);

    const [seferler] = await pool.query(
      `SELECT s.id, s.fis_no, s.durum, s.cikis_tarihi, s.donus_tarihi,
              s.aciklama, l.kod AS pazar_kod, l.ad AS pazar_adi,
              k.ad AS olusturan_adi,
              COALESCE(SUM(sk.giden_miktar), 0) AS toplam_giden,
              COALESCE(SUM(sk.donen_miktar), 0) AS toplam_donen,
              COALESCE(SUM(sk.giden_miktar - COALESCE(sk.donen_miktar, 0)), 0) AS toplam_satilan
       FROM pazar_seferleri s
       JOIN lokasyonlar l ON s.lokasyon_id = l.id
       LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
       LEFT JOIN pazar_sefer_kalemleri sk ON sk.sefer_id = s.id${kosul}
       GROUP BY s.id
       ORDER BY s.cikis_tarihi DESC, s.id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    res.json(seferler);
  } catch (err) {
    next(err);
  }
};

const detay = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [kalemler] = await pool.query(
      `SELECT sk.id, sk.varyant_id, sk.giden_miktar, sk.donen_miktar,
              u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg,
              v.perakende_fiyat
       FROM pazar_sefer_kalemleri sk
       JOIN urun_varyantlari v ON sk.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
       WHERE sk.sefer_id = ?
       ORDER BY u.ad, v.boy`,
      [id],
    );

    res.json(kalemler);
  } catch (err) {
    next(err);
  }
};

const seferAc = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    // Govde schemas/marketTrip.js tarafindan dogrulandi.
    const { lokasyon_id, kalemler, tahsisler, aciklama } = req.body;

    const istekler = new Map();

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

    const [pazarRows] = await connection.query(
      `SELECT id, kod, ad FROM lokasyonlar
       WHERE id = ? AND tip = 'pazar' AND aktif = TRUE`,
      [lokasyon_id],
    );

    if (!pazarRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Pazar bulunamadı" });
    }

    // Veritabanindaki yolda_tek kisiti ayni anda tek acik sefer olmasini
    // zaten garanti ediyor. Buradaki kontrol kullaniciya anlamli bir mesaj
    // vermek icin; asil koruma semada.
    const [acikRows] = await connection.query(
      "SELECT fis_no FROM pazar_seferleri WHERE durum = 'yolda' FOR UPDATE",
    );

    if (acikRows.length) {
      await connection.rollback();
      return res.status(409).json({
        hata: `${acikRows[0].fis_no} numaralı sefer hâlâ yolda, önce onu kapatın`,
      });
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

    const cikan = new Map();

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

      cikan.set(
        birim.varyant_id,
        yuvarla((cikan.get(birim.varyant_id) || 0) + istenen),
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
      const secilen = cikan.get(varyantId) || 0;
      if (secilen !== miktar) {
        await connection.rollback();
        return res.status(400).json({
          hata: `Varyant ${varyantId} için seçilen miktar listeyle uyuşmuyor — listede ${miktar.toFixed(0)}, seçilen ${secilen.toFixed(0)}`,
        });
      }
    }

    for (const varyantId of cikan.keys()) {
      if (!gereken.has(varyantId)) {
        await connection.rollback();
        return res
          .status(400)
          .json({ hata: "Listede olmayan bir ürün için birim seçilmiş" });
      }
    }

    const yil = new Date().getFullYear();

    const [sonRows] = await connection.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(fis_no, 8) AS UNSIGNED)), 0) AS son
       FROM pazar_seferleri
       WHERE fis_no LIKE ?`,
      [`P-${yil}-%`],
    );

    const fisNo = `P-${yil}-${String(Number(sonRows[0].son) + 1).padStart(4, "0")}`;

    const [seferSonuc] = await connection.query(
      `INSERT INTO pazar_seferleri
       (fis_no, lokasyon_id, cikis_tarihi, durum, aciklama, olusturan_kullanici_id)
       VALUES (?, ?, ?, 'yolda', ?, ?)`,
      [fisNo, lokasyon_id, yerelTarih(), aciklama || null, req.kullanici.id],
    );

    const seferId = seferSonuc.insertId;

    const kalemSatirlari = [...gereken.entries()].map(([varyantId, miktar]) => [
      seferId,
      varyantId,
      miktar,
    ]);

    await connection.query(
      `INSERT INTO pazar_sefer_kalemleri (sefer_id, varyant_id, giden_miktar)
       VALUES ?`,
      [kalemSatirlari],
    );

    // Mal depodan pazara tasiniyor. Toplam stok degismiyor, bu yuzden
    // urun_varyantlari.miktar'a dokunulmuyor ve stok_hareketleri'ne kayit
    // yazilmiyor; bu bir cikis degil, yer degistirme.
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
    }

    for (const [varyantId, miktar] of gereken) {
      await connection.query(
        `INSERT INTO stok_birimleri
         (tip, varyant_id, lokasyon_id, miktar, olusturan_kullanici_id)
         VALUES ('dokme', ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE miktar = miktar + ?`,
        [varyantId, lokasyon_id, miktar, req.kullanici.id, miktar],
      );
    }

    await connection.commit();

    res.status(201).json({
      id: seferId,
      fis_no: fisNo,
      mesaj: `${fisNo} numaralı sefer açıldı, mal ${pazarRows[0].ad || pazarRows[0].kod} lokasyonuna taşındı`,
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

const seferKapat = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { kalemler } = req.body;

    const donenler = new Map();

    for (const kalem of kalemler) {
      if (donenler.has(kalem.varyant_id)) {
        return res.status(400).json({
          hata: `Aynı ürün listede birden fazla kez var (id: ${kalem.varyant_id})`,
        });
      }
      donenler.set(kalem.varyant_id, kalem.donen_miktar);
    }

    await connection.beginTransaction();

    const [seferRows] = await connection.query(
      `SELECT id, fis_no, lokasyon_id, durum
       FROM pazar_seferleri WHERE id = ? FOR UPDATE`,
      [id],
    );

    if (!seferRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Sefer bulunamadı" });
    }

    const sefer = seferRows[0];

    if (sefer.durum !== "yolda") {
      await connection.rollback();
      return res.status(400).json({ hata: "Bu sefer zaten kapatılmış" });
    }

    const [kabulRows] = await connection.query(
      `SELECT id, kod FROM lokasyonlar
       WHERE tip = 'kabul' AND aktif = TRUE ORDER BY id LIMIT 1`,
    );

    if (!kabulRows.length) {
      await connection.rollback();
      return res.status(400).json({
        hata: "Mal kabul alanı tanımlı değil, dönen mal nereye girecek belirlenemiyor",
      });
    }

    const kabulId = kabulRows[0].id;

    const [seferKalemleri] = await connection.query(
      `SELECT varyant_id, giden_miktar FROM pazar_sefer_kalemleri
       WHERE sefer_id = ? ORDER BY varyant_id`,
      [id],
    );

    for (const kalem of seferKalemleri) {
      if (!donenler.has(kalem.varyant_id)) {
        await connection.rollback();
        return res.status(400).json({
          hata: `Varyant ${kalem.varyant_id} için dönen miktar girilmedi`,
        });
      }

      const donen = donenler.get(kalem.varyant_id);

      if (donen > Number(kalem.giden_miktar)) {
        await connection.rollback();
        return res.status(400).json({
          hata: `Dönen miktar gidenden fazla olamaz (giden ${Number(kalem.giden_miktar).toFixed(0)}, dönen ${donen.toFixed(0)})`,
        });
      }
    }

    const [pazarBirimleri] = await connection.query(
      `SELECT id, varyant_id, miktar FROM stok_birimleri
       WHERE lokasyon_id = ? AND tip = 'dokme'
       ORDER BY id
       FOR UPDATE`,
      [sefer.lokasyon_id],
    );

    const pazarHaritasi = new Map(pazarBirimleri.map((b) => [b.varyant_id, b]));

    for (const kalem of seferKalemleri) {
      const pazardaki = pazarHaritasi.get(kalem.varyant_id);
      const giden = yuvarla(Number(kalem.giden_miktar));

      // Pazara yalnizca sefer acilisi mal koyar, yalnizca kapanis bosaltir.
      // Bu iki sayi ayrisiyorsa arada baska bir islem araya girmis demektir;
      // sessizce duzeltmek yerine durup bildiriyoruz.
      if (!pazardaki || yuvarla(Number(pazardaki.miktar)) !== giden) {
        await connection.rollback();
        return res.status(409).json({
          hata: `Pazardaki stok beklenenden farklı (beklenen ${giden.toFixed(0)}, bulunan ${pazardaki ? Number(pazardaki.miktar).toFixed(0) : 0}). Sefer gözden geçirilmeli.`,
        });
      }
    }

    for (const kalem of seferKalemleri) {
      const varyantId = kalem.varyant_id;
      const giden = yuvarla(Number(kalem.giden_miktar));
      const donen = yuvarla(donenler.get(varyantId));
      const satilan = yuvarla(giden - donen);
      const pazardaki = pazarHaritasi.get(varyantId);

      await connection.query(
        "UPDATE stok_birimleri SET miktar = 0 WHERE id = ?",
        [pazardaki.id],
      );

      await connection.query("DELETE FROM stok_birimleri WHERE id = ?", [
        pazardaki.id,
      ]);

      if (donen > 0) {
        await connection.query(
          `INSERT INTO stok_birimleri
           (tip, varyant_id, lokasyon_id, miktar, olusturan_kullanici_id)
           VALUES ('dokme', ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE miktar = miktar + ?`,
          [varyantId, kabulId, donen, req.kullanici.id, donen],
        );
      }

      // Satilan kisim gercek bir stok cikisi: toplam envanter azaliyor.
      if (satilan > 0) {
        await connection.query(
          "UPDATE urun_varyantlari SET miktar = miktar - ? WHERE id = ?",
          [satilan, varyantId],
        );

        await connection.query(
          `INSERT INTO stok_hareketleri
           (varyant_id, lokasyon_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
           VALUES (?, ?, 'cikis', 'satis', ?, ?, ?)`,
          [
            varyantId,
            sefer.lokasyon_id,
            satilan,
            `${sefer.fis_no} pazar satışı`,
            req.kullanici.id,
          ],
        );
      }

      await connection.query(
        `UPDATE pazar_sefer_kalemleri SET donen_miktar = ?
         WHERE sefer_id = ? AND varyant_id = ?`,
        [donen, id, varyantId],
      );
    }

    const [durumSonuc] = await connection.query(
      `UPDATE pazar_seferleri
       SET durum = 'tamamlandi', donus_tarihi = ?
       WHERE id = ? AND durum = 'yolda'`,
      [yerelTarih(), id],
    );

    if (durumSonuc.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({
        hata: "Sefer başka bir işlem tarafından kapatılmış",
      });
    }

    await connection.commit();

    res.json({ mesaj: `${sefer.fis_no} numaralı sefer kapatıldı` });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

module.exports = { listele, detay, seferAc, seferKapat };
