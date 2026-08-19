const pool = require("../config/db");
const { reservedQuantity } = require("../utils/reservations");
const { buildPagination } = require("../utils/pagination");
const { paletGozuDolu } = require("../utils/paletGozu");

const list = async (req, res, next) => {
  try {
    const { varyant_id, lokasyon_id, tip, ara } = req.query;
    const { limit, offset } = buildPagination(req.query);

    let kosul = " WHERE 1=1";
    const degerler = [];

    if (varyant_id) {
      kosul += " AND sb.varyant_id = ?";
      degerler.push(varyant_id);
    }
    if (lokasyon_id) {
      kosul += " AND sb.lokasyon_id = ?";
      degerler.push(lokasyon_id);
    }
    if (tip === "palet" || tip === "dokme") {
      kosul += " AND sb.tip = ?";
      degerler.push(tip);
    }
    if (ara) {
      kosul += " AND (sb.kod LIKE ? OR u.ad LIKE ? OR l.kod LIKE ?)";
      degerler.push(`%${ara}%`, `%${ara}%`, `%${ara}%`);
    }

    const govde = `
      FROM stok_birimleri sb
      JOIN urun_varyantlari v ON sb.varyant_id = v.id
      JOIN urunler u ON v.urun_id = u.id
      JOIN lokasyonlar l ON sb.lokasyon_id = l.id`;

    const [sayim] = await pool.query(
      "SELECT COUNT(*) AS toplam" + govde + kosul,
      degerler,
    );
    res.set("X-Toplam-Kayit", sayim[0].toplam);

    const [rows] = await pool.query(
      `SELECT sb.id, sb.tip, sb.kod, sb.miktar, sb.olusturulma_tarihi,
              sb.varyant_id, sb.lokasyon_id,
              COALESCE(r.rezerve, 0) AS rezerve,
              sb.miktar - COALESCE(r.rezerve, 0) AS kullanilabilir,
              u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg,
              l.kod AS lokasyon_kod, l.ad AS lokasyon_adi,
              k.ad AS olusturan_adi
       ${govde}
       LEFT JOIN kullanicilar k ON sb.olusturan_kullanici_id = k.id
       LEFT JOIN (
         SELECT birim_id, SUM(miktar) AS rezerve
         FROM stok_rezervasyonlari
         GROUP BY birim_id
       ) r ON r.birim_id = sb.id
       ${kosul}
       ORDER BY sb.tip, sb.kod, l.kod
       LIMIT ? OFFSET ?`,
      [...degerler, limit, offset],
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const findByCode = async (req, res, next) => {
  try {
    const kod = String(req.params.kod || "").trim();

    if (!kod) {
      return res.status(400).json({ hata: "Palet kodu gönderilmedi" });
    }

    const [rows] = await pool.query(
      `SELECT sb.id, sb.tip, sb.kod, sb.miktar,
              sb.varyant_id, sb.lokasyon_id,
              u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg,
              l.kod AS lokasyon_kod, l.ad AS lokasyon_adi
       FROM stok_birimleri sb
       JOIN urun_varyantlari v ON sb.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
       JOIN lokasyonlar l ON sb.lokasyon_id = l.id
       WHERE sb.kod = ?`,
      [kod],
    );

    if (!rows.length) {
      return res.status(404).json({ hata: "Bu kodda palet bulunamadı" });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const palletize = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    // Govde schemas/stockUnit.js tarafindan dogrulandi: kimlikler pozitif
    // tam sayi, miktar pozitif, kod kirpilmis ve en fazla 30 karakter.
    const {
      varyant_id: varyantId,
      lokasyon_id: lokasyonId,
      miktar: alinacak,
      kod: paletKodu,
    } = req.body;

    await connection.beginTransaction();

    const [lokasyonRows] = await connection.query(
      "SELECT id, tip FROM lokasyonlar WHERE id = ? AND aktif = TRUE",
      [lokasyonId],
    );

    if (!lokasyonRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Lokasyon bulunamadı" });
    }

    if (
      lokasyonRows[0].tip === "palet" &&
      (await paletGozuDolu(connection, lokasyonId))
    ) {
      await connection.rollback();
      return res.status(409).json({
        hata: "Bu palet gözünde zaten bir palet var, önce onu başka yere taşıyın",
      });
    }

    const [dokmeRows] = await connection.query(
      `SELECT id, miktar FROM stok_birimleri
       WHERE tip = 'dokme' AND varyant_id = ? AND lokasyon_id = ?
       FOR UPDATE`,
      [varyantId, lokasyonId],
    );

    const mevcut = dokmeRows.length ? Number(dokmeRows[0].miktar) : 0;
    const rezerve = dokmeRows.length
      ? await reservedQuantity(connection, dokmeRows[0].id)
      : 0;
    const kullanilabilir = mevcut - rezerve;

    if (kullanilabilir < alinacak) {
      await connection.rollback();
      return res.status(400).json({
        hata: `Bu lokasyonda paletlenecek kadar serbest dökme stok yok (mevcut ${mevcut.toFixed(0)}, ${rezerve.toFixed(0)} adedi siparişlere ayrılmış)`,
      });
    }

    const [dususSonuc] = await connection.query(
      `UPDATE stok_birimleri SET miktar = miktar - ?
       WHERE id = ? AND miktar >= ?`,
      [alinacak, dokmeRows[0].id, alinacak],
    );

    if (dususSonuc.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({
        hata: "Stok bu sırada değişmiş, işlem geri alındı. Tekrar deneyin.",
      });
    }

    await connection.query(
      "DELETE FROM stok_birimleri WHERE id = ? AND miktar = 0",
      [dokmeRows[0].id],
    );

    await connection.query(
      `INSERT INTO stok_birimleri
       (tip, kod, varyant_id, lokasyon_id, miktar, olusturan_kullanici_id)
       VALUES ('palet', ?, ?, ?, ?, ?)`,
      [paletKodu, varyantId, lokasyonId, alinacak, req.kullanici.id],
    );

    await connection.commit();

    res.status(201).json({ mesaj: `${paletKodu} paleti oluşturuldu` });
  } catch (err) {
    await connection.rollback().catch(() => {});
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ hata: "Bu palet kodu zaten kullanılıyor" });
    }
    next(err);
  } finally {
    connection.release();
  }
};
const addToPallet = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const paletId = parseInt(req.params.id, 10);
    const { miktar: eklenecek, yeni_kod: yeniKod } = req.body;

    if (!Number.isInteger(paletId)) {
      return res.status(400).json({ hata: "Geçersiz palet" });
    }

    await connection.beginTransaction();

    const [paletRows] = await connection.query(
      `SELECT id, kod, varyant_id, lokasyon_id, miktar
       FROM stok_birimleri
       WHERE id = ? AND tip = 'palet'
       FOR UPDATE`,
      [paletId],
    );

    if (!paletRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Palet bulunamadı" });
    }

    const palet = paletRows[0];

    const [dokmeRows] = await connection.query(
      `SELECT id, miktar FROM stok_birimleri
       WHERE tip = 'dokme' AND varyant_id = ? AND lokasyon_id = ?
       FOR UPDATE`,
      [palet.varyant_id, palet.lokasyon_id],
    );

    if (!dokmeRows.length) {
      await connection.rollback();
      return res.status(400).json({
        hata: "Bu lokasyonda paletle aynı üründen dökme stok yok",
      });
    }

    const mevcut = Number(dokmeRows[0].miktar);
    const rezerve = await reservedQuantity(connection, dokmeRows[0].id);
    const kullanilabilir = mevcut - rezerve;

    if (kullanilabilir < eklenecek) {
      await connection.rollback();
      return res.status(400).json({
        hata: `Eklenecek kadar serbest dökme stok yok (mevcut ${mevcut.toFixed(0)}, ${rezerve.toFixed(0)} adedi siparişlere ayrılmış)`,
      });
    }

    const [dususSonuc] = await connection.query(
      `UPDATE stok_birimleri SET miktar = miktar - ?
       WHERE id = ? AND miktar >= ?`,
      [eklenecek, dokmeRows[0].id, eklenecek],
    );

    if (dususSonuc.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({
        hata: "Stok bu sırada değişmiş, işlem geri alındı. Tekrar deneyin.",
      });
    }

    await connection.query(
      "DELETE FROM stok_birimleri WHERE id = ? AND miktar = 0",
      [dokmeRows[0].id],
    );

    await connection.query(
      "UPDATE stok_birimleri SET miktar = miktar + ? WHERE id = ?",
      [eklenecek, paletId],
    );

    if (yeniKod && yeniKod !== palet.kod) {
      await connection.query("UPDATE stok_birimleri SET kod = ? WHERE id = ?", [
        yeniKod,
        paletId,
      ]);
    }

    await connection.commit();

    const sonKod = yeniKod || palet.kod;
    const sonMiktar = Number(palet.miktar) + Number(eklenecek);

    res.json({
      mesaj: `${sonKod} paleti ${sonMiktar.toFixed(0)} adede çıkarıldı`,
    });
  } catch (err) {
    await connection.rollback().catch(() => {});

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ hata: "Bu palet kodu zaten kullanılıyor" });
    }

    next(err);
  } finally {
    connection.release();
  }
};

module.exports = { list, findByCode, palletize, addToPallet };
