const pool = require("../config/db");
const { reservedQuantity } = require("../utils/reservations");

const GECERLI_SEBEPLER = [
  "satinalma",
  "satis",
  "sayim",
  "fire",
  "iade",
  "manuel",
];

const listele = async (req, res, next) => {
  try {
    const { varyant_id, tip, sebep, baslangic, bitis, sayfa, limit } =
      req.query;

    let kosul = " WHERE 1=1";
    const kosulDegerleri = [];

    if (varyant_id) {
      kosul += " AND sh.varyant_id = ?";
      kosulDegerleri.push(varyant_id);
    }

    if (tip) {
      kosul += " AND sh.tip = ?";
      kosulDegerleri.push(tip);
    }

    if (sebep) {
      kosul += " AND sh.sebep = ?";
      kosulDegerleri.push(sebep);
    }

    if (baslangic) {
      kosul += " AND sh.tarih >= ?";
      kosulDegerleri.push(baslangic + " 00:00:00");
    }

    if (bitis) {
      kosul += " AND sh.tarih <= ?";
      kosulDegerleri.push(bitis + " 23:59:59");
    }

    const [sayim] = await pool.query(
      "SELECT COUNT(*) AS toplam FROM stok_hareketleri sh" + kosul,
      kosulDegerleri,
    );
    res.set("X-Toplam-Kayit", sayim[0].toplam);

    let sorgu =
      `SELECT sh.id, sh.varyant_id, sh.lokasyon_id, sh.tip, sh.sebep,
              sh.miktar, sh.aciklama, sh.tarih,
              u.ad AS urun_adi, v.boy, v.ambalaj_tipi, v.ambalaj_kg,
              k.ad AS kullanici_adi, l.kod AS lokasyon_kod
       FROM stok_hareketleri sh
       JOIN urun_varyantlari v ON sh.varyant_id = v.id
       JOIN urunler u ON v.urun_id = u.id
       LEFT JOIN kullanicilar k ON sh.olusturan_kullanici_id = k.id
       LEFT JOIN lokasyonlar l ON sh.lokasyon_id = l.id` +
      kosul +
      " ORDER BY sh.tarih DESC";

    const degerler = [...kosulDegerleri];

    const sayfaNo = parseInt(sayfa, 10) || 1;
    const limitSayi = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (sayfaNo - 1) * limitSayi;

    sorgu += " LIMIT ? OFFSET ?";
    degerler.push(limitSayi, offset);

    const [rows] = await pool.query(sorgu, degerler);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const ekle = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { varyant_id, lokasyon_id, birim_id, tip, sebep, miktar, aciklama } =
      req.body;

    if (!["giris", "cikis"].includes(tip)) {
      return res
        .status(400)
        .json({ hata: "Hareket tipi giris veya cikis olmalı" });
    }

    if (sebep && !GECERLI_SEBEPLER.includes(sebep)) {
      return res.status(400).json({ hata: "Geçersiz sebep" });
    }

    const hareketMiktari = Number(miktar);

    if (!Number.isFinite(hareketMiktari) || hareketMiktari <= 0) {
      return res.status(400).json({ hata: "Miktar sıfırdan büyük olmalıdır" });
    }

    if (tip === "giris") {
      if (!varyant_id || !lokasyon_id) {
        return res
          .status(400)
          .json({ hata: "Varyant ve lokasyon seçilmelidir" });
      }

      await connection.beginTransaction();

      const [varyantRows] = await connection.query(
        "SELECT id FROM urun_varyantlari WHERE id = ?",
        [varyant_id],
      );

      if (!varyantRows.length) {
        await connection.rollback();
        return res.status(404).json({ hata: "Varyant bulunamadı" });
      }

      const [lokasyonRows] = await connection.query(
        "SELECT id FROM lokasyonlar WHERE id = ? AND aktif = TRUE",
        [lokasyon_id],
      );

      if (!lokasyonRows.length) {
        await connection.rollback();
        return res.status(404).json({ hata: "Lokasyon bulunamadı" });
      }

      await connection.query(
        `INSERT INTO stok_hareketleri
         (varyant_id, lokasyon_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
         VALUES (?, ?, 'giris', ?, ?, ?, ?)`,
        [
          varyant_id,
          lokasyon_id,
          sebep || "manuel",
          hareketMiktari,
          aciklama || null,
          req.kullanici.id,
        ],
      );

      await connection.query(
        "UPDATE urun_varyantlari SET miktar = miktar + ? WHERE id = ?",
        [hareketMiktari, varyant_id],
      );

      await connection.query(
        `INSERT INTO stok_birimleri
         (tip, varyant_id, lokasyon_id, miktar, olusturan_kullanici_id)
         VALUES ('dokme', ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE miktar = miktar + ?`,
        [
          varyant_id,
          lokasyon_id,
          hareketMiktari,
          req.kullanici.id,
          hareketMiktari,
        ],
      );

      await connection.commit();
      return res.status(201).json({ mesaj: "Stok hareketi kaydedildi" });
    }

    const birimId = Number(birim_id);

    if (!Number.isInteger(birimId) || birimId <= 0) {
      return res
        .status(400)
        .json({ hata: "Çıkış yapılacak stok birimi seçilmelidir" });
    }

    await connection.beginTransaction();

    const [birimRows] = await connection.query(
      `SELECT id, tip, kod, varyant_id, lokasyon_id, miktar
       FROM stok_birimleri WHERE id = ? FOR UPDATE`,
      [birimId],
    );

    if (!birimRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Stok birimi bulunamadı" });
    }

    const birim = birimRows[0];
    const rezerve = await reservedQuantity(connection, birimId);
    const kullanilabilir = Number(birim.miktar) - rezerve;

    if (kullanilabilir < hareketMiktari) {
      await connection.rollback();
      return res.status(400).json({
        hata: `${birim.kod || "Dökme"} biriminde yeterli kullanılabilir stok yok (mevcut ${Number(birim.miktar).toFixed(0)}, ${rezerve.toFixed(0)} adedi siparişlere ayrılmış)`,
      });
    }

    const [dususSonuc] = await connection.query(
      `UPDATE stok_birimleri SET miktar = miktar - ?
       WHERE id = ? AND miktar >= ?`,
      [hareketMiktari, birimId, hareketMiktari],
    );

    if (dususSonuc.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({
        hata: "Stok bu sırada değişmiş, işlem geri alındı. Tekrar deneyin.",
      });
    }

    await connection.query(
      "DELETE FROM stok_birimleri WHERE id = ? AND miktar = 0",
      [birimId],
    );

    await connection.query(
      "UPDATE urun_varyantlari SET miktar = miktar - ? WHERE id = ?",
      [hareketMiktari, birim.varyant_id],
    );

    await connection.query(
      `INSERT INTO stok_hareketleri
       (varyant_id, lokasyon_id, tip, sebep, miktar, aciklama, olusturan_kullanici_id)
       VALUES (?, ?, 'cikis', ?, ?, ?, ?)`,
      [
        birim.varyant_id,
        birim.lokasyon_id,
        sebep || "manuel",
        hareketMiktari,
        birim.kod
          ? `${birim.kod}${aciklama ? ` · ${aciklama}` : ""}`
          : aciklama || null,
        req.kullanici.id,
      ],
    );

    await connection.commit();

    res.status(201).json({ mesaj: "Stok hareketi kaydedildi" });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

module.exports = { listele, ekle };
