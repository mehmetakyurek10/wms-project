const pool = require("../config/db");

const yuvarla = (sayi) => Math.round(sayi * 100) / 100;

const kaydet = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    // Govde schemas/stocktake.js tarafindan dogrulandi: lokasyon_id pozitif
    // tam sayi, kalemler bos olmayan dizi, her kalemde sayilan_miktar negatif
    // olmayan sayi ve birim_id ile varyant_id'den en az biri mevcut.
    const { lokasyon_id: lokasyonId, kalemler, aciklama } = req.body;

    const birimSayimlari = new Map();
    const varyantSayimlari = new Map();

    // Ayni birimin ya da varyantin listede iki kez bulunmasi semada
    // yakalanamaz; bu kontrol kalemler arasi bir kural.
    for (const kalem of kalemler) {
      const sayilan = yuvarla(kalem.sayilan_miktar);

      if (kalem.birim_id !== undefined) {
        if (birimSayimlari.has(kalem.birim_id)) {
          return res.status(400).json({
            hata: `Aynı birim listede birden fazla kez var (id: ${kalem.birim_id})`,
          });
        }
        birimSayimlari.set(kalem.birim_id, sayilan);
        continue;
      }

      if (varyantSayimlari.has(kalem.varyant_id)) {
        return res.status(400).json({
          hata: `Aynı varyant listede birden fazla kez var (id: ${kalem.varyant_id})`,
        });
      }
      varyantSayimlari.set(kalem.varyant_id, sayilan);
    }

    await connection.beginTransaction();

    const [lokasyonRows] = await connection.query(
      "SELECT id, tip FROM lokasyonlar WHERE id = ? AND aktif = TRUE",
      [lokasyonId],
    );

    if (!lokasyonRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Lokasyon bulunamadı" });
    }

    // Pazardaki mal tezgahta, depoda degil. Sayilacak bir sey yok; oradaki
    // miktar sefer kapatilirken donen miktarla belirlenir.
    if (lokasyonRows[0].tip === "pazar") {
      await connection.rollback();
      return res.status(400).json({
        hata: "Pazardaki mal sayılamaz, sefer kapatılarak işlenir",
      });
    }

    const [mevcutBirimler] = await connection.query(
      `SELECT id, tip, kod, varyant_id, miktar
       FROM stok_birimleri
       WHERE lokasyon_id = ?
       ORDER BY id
       FOR UPDATE`,
      [lokasyonId],
    );

    const birimHaritasi = new Map(mevcutBirimler.map((b) => [b.id, b]));

    for (const birimId of birimSayimlari.keys()) {
      if (!birimHaritasi.has(birimId)) {
        await connection.rollback();
        return res.status(404).json({
          hata: `Bu lokasyonda ${birimId} numaralı stok birimi yok`,
        });
      }
    }

    for (const varyantId of varyantSayimlari.keys()) {
      const cakisan = mevcutBirimler.find(
        (b) =>
          b.tip === "dokme" &&
          b.varyant_id === varyantId &&
          birimSayimlari.has(b.id),
      );
      if (cakisan) {
        await connection.rollback();
        return res.status(400).json({
          hata: "Aynı ürünün dökme stoğu hem birim hem varyant olarak sayılmış",
        });
      }
    }

    const varyantIdleri = [...varyantSayimlari.keys()].sort((a, b) => a - b);

    if (varyantIdleri.length) {
      const [varyantRows] = await connection.query(
        "SELECT id FROM urun_varyantlari WHERE id IN (?)",
        [varyantIdleri],
      );

      if (varyantRows.length !== varyantIdleri.length) {
        const bulunanlar = new Set(varyantRows.map((r) => r.id));
        const eksik = varyantIdleri.filter((vid) => !bulunanlar.has(vid));
        await connection.rollback();
        return res
          .status(404)
          .json({ hata: `Varyant bulunamadı (id: ${eksik.join(", ")})` });
      }
    }

    // Asagidaki iki dongu yalnizca hesap yapiyor; sorgular sonda toplu
    // olarak calisiyor. Onceki halinde her kalem icin dort ayri sorgu
    // gidiyordu ve kilitlenen satirlar bu sure boyunca acik kaliyordu.
    const sonuclar = [];
    const birimGuncellemeleri = [];
    const dokmeSatirlari = [];
    const dokmeVaryantIdleri = [];
    const hareketSatirlari = [];
    const varyantFarklari = new Map();

    const farkEkle = (varyantId, fark) => {
      varyantFarklari.set(
        varyantId,
        yuvarla((varyantFarklari.get(varyantId) || 0) + fark),
      );
    };

    const hareketSatiri = (varyantId, fark, etiket) => [
      varyantId,
      lokasyonId,
      fark > 0 ? "giris" : "cikis",
      "sayim",
      Math.abs(fark),
      `${aciklama || "Stok sayımı"}${etiket ? ` · ${etiket}` : ""}`,
      req.kullanici.id,
    ];

    for (const birimId of [...birimSayimlari.keys()].sort((a, b) => a - b)) {
      const birim = birimHaritasi.get(birimId);
      const sayilan = birimSayimlari.get(birimId);
      const mevcut = yuvarla(Number(birim.miktar));
      const fark = yuvarla(sayilan - mevcut);

      if (fark === 0) continue;

      birimGuncellemeleri.push([birimId, sayilan]);
      farkEkle(birim.varyant_id, fark);
      hareketSatirlari.push(
        hareketSatiri(birim.varyant_id, fark, birim.kod || "Dökme"),
      );

      sonuclar.push({
        birim_id: birimId,
        kod: birim.kod,
        varyant_id: birim.varyant_id,
        mevcut,
        sayilan,
        fark,
      });
    }

    for (const varyantId of varyantIdleri) {
      const sayilan = varyantSayimlari.get(varyantId);
      const dokme = mevcutBirimler.find(
        (b) => b.tip === "dokme" && b.varyant_id === varyantId,
      );
      const mevcut = dokme ? yuvarla(Number(dokme.miktar)) : 0;
      const fark = yuvarla(sayilan - mevcut);

      if (fark === 0) continue;

      dokmeSatirlari.push([
        "dokme",
        varyantId,
        lokasyonId,
        sayilan,
        req.kullanici.id,
      ]);
      dokmeVaryantIdleri.push(varyantId);
      farkEkle(varyantId, fark);
      hareketSatirlari.push(hareketSatiri(varyantId, fark, "Dökme"));

      sonuclar.push({
        varyant_id: varyantId,
        kod: null,
        mevcut,
        sayilan,
        fark,
      });
    }

    if (birimGuncellemeleri.length) {
      const birimIdleri = birimGuncellemeleri.map(([birimId]) => birimId);
      const birimCase = birimGuncellemeleri
        .map(() => "WHEN ? THEN ?")
        .join(" ");
      const birimDegerleri = birimGuncellemeleri.flat();

      await connection.query(
        `UPDATE stok_birimleri
         SET miktar = CASE id ${birimCase} ELSE miktar END
         WHERE id IN (?)`,
        [...birimDegerleri, birimIdleri],
      );

      await connection.query(
        "DELETE FROM stok_birimleri WHERE id IN (?) AND miktar = 0",
        [birimIdleri],
      );
    }

    if (dokmeSatirlari.length) {
      await connection.query(
        `INSERT INTO stok_birimleri
         (tip, varyant_id, lokasyon_id, miktar, olusturan_kullanici_id)
         VALUES ?
         AS yeni
         ON DUPLICATE KEY UPDATE miktar = yeni.miktar`,
        [dokmeSatirlari],
      );

      await connection.query(
        `DELETE FROM stok_birimleri
         WHERE tip = 'dokme' AND lokasyon_id = ? AND varyant_id IN (?)
           AND miktar = 0`,
        [lokasyonId, dokmeVaryantIdleri],
      );
    }

    if (varyantFarklari.size) {
      const farkIdleri = [...varyantFarklari.keys()].sort((a, b) => a - b);
      const farkCase = farkIdleri.map(() => "WHEN ? THEN ?").join(" ");
      const farkDegerleri = [];
      for (const varyantId of farkIdleri) {
        farkDegerleri.push(varyantId, varyantFarklari.get(varyantId));
      }

      await connection.query(
        `UPDATE urun_varyantlari
         SET miktar = miktar + CASE id ${farkCase} ELSE 0 END
         WHERE id IN (?)`,
        [...farkDegerleri, farkIdleri],
      );

      await connection.query(
        `INSERT INTO stok_hareketleri
         (varyant_id, lokasyon_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
         VALUES ?`,
        [hareketSatirlari],
      );
    }

    await connection.commit();

    res.json({
      mesaj: sonuclar.length
        ? `${sonuclar.length} birimde düzeltme yapıldı`
        : "Fark bulunamadı, stoklar zaten doğru",
      sonuclar,
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

module.exports = { kaydet };
