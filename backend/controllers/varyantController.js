const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const { urun_id, ara } = req.query;

    let sorgu = `
      SELECT v.*, u.ad AS urun_adi, k.ad AS kategori_adi
      FROM urun_varyantlari v
      JOIN urunler u ON v.urun_id = u.id
      LEFT JOIN kategoriler k ON u.kategori_id = k.id
      WHERE 1=1`;
    const degerler = [];

    if (urun_id) {
      sorgu += " AND v.urun_id = ?";
      degerler.push(urun_id);
    }

    if (ara) {
      sorgu += " AND (u.ad LIKE ? OR v.boy LIKE ? OR v.barkod LIKE ?)";
      degerler.push(`%${ara}%`, `%${ara}%`, `%${ara}%`);
    }

    sorgu += " ORDER BY u.ad, v.boy";

    const [rows] = await pool.query(sorgu, degerler);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const dusukStok = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.*, u.ad AS urun_adi
       FROM urun_varyantlari v
       JOIN urunler u ON v.urun_id = u.id
       WHERE v.aktif = TRUE AND v.miktar <= v.kritik_seviye
       ORDER BY u.ad, v.boy`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const ekle = async (req, res, next) => {
  try {
    const {
      urun_id,
      boy,
      ambalaj_tipi,
      ambalaj_kg,
      barkod,
      miktar,
      kritik_seviye,
      birim_fiyat,
    } = req.body;

    if (!urun_id || !boy) {
      return res.status(400).json({ hata: "Ürün ve boy (kalibre) zorunludur" });
    }

    const [result] = await pool.query(
      `INSERT INTO urun_varyantlari
       (urun_id, boy, ambalaj_tipi, ambalaj_kg, barkod, miktar, kritik_seviye, birim_fiyat)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        urun_id,
        boy,
        ambalaj_tipi || "kova",
        ambalaj_kg || 10,
        barkod || null,
        miktar || 0,
        kritik_seviye || 0,
        birim_fiyat || 0,
      ],
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        hata: "Bu ürün için aynı boy ve ambalajda varyant zaten var, ya da barkod başka bir varyantta kullanılıyor",
      });
    }
    next(err);
  }
};

const guncelle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      boy,
      ambalaj_tipi,
      ambalaj_kg,
      barkod,
      kritik_seviye,
      birim_fiyat,
      aktif,
    } = req.body;

    const [sonuc] = await pool.query(
      `UPDATE urun_varyantlari
       SET boy=?, ambalaj_tipi=?, ambalaj_kg=?, barkod=?, kritik_seviye=?, birim_fiyat=?, aktif=?
       WHERE id=?`,
      [
        boy,
        ambalaj_tipi,
        ambalaj_kg,
        barkod || null,
        kritik_seviye,
        birim_fiyat,
        aktif ?? true,
        id,
      ],
    );

    if (sonuc.affectedRows === 0) {
      return res.status(404).json({ hata: "Varyant bulunamadı" });
    }

    res.json({ mesaj: "Güncellendi" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({
          hata: "Bu boy/ambalaj kombinasyonu ya da barkod zaten kullanımda",
        });
    }
    next(err);
  }
};

const sil = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [hareket] = await pool.query(
      "SELECT COUNT(*) AS adet FROM stok_hareketleri WHERE varyant_id = ?",
      [id],
    );
    if (hareket[0].adet > 0) {
      return res.status(409).json({
        hata: `Bu varyantın ${hareket[0].adet} stok hareketi var, silinemez. Bunun yerine pasife alabilirsiniz.`,
      });
    }

    const [kalem] = await pool.query(
      "SELECT COUNT(*) AS adet FROM satinalma_siparis_kalemleri WHERE varyant_id = ?",
      [id],
    );
    if (kalem[0].adet > 0) {
      return res.status(409).json({
        hata: `Bu varyant ${kalem[0].adet} satınalma kaleminde kullanılmış, silinemez.`,
      });
    }

    const [sonuc] = await pool.query(
      "DELETE FROM urun_varyantlari WHERE id = ?",
      [id],
    );

    if (sonuc.affectedRows === 0) {
      return res.status(404).json({ hata: "Varyant bulunamadı" });
    }

    res.json({ mesaj: "Varyant silindi" });
  } catch (err) {
    next(err);
  }
};

module.exports = { listele, dusukStok, ekle, guncelle, sil };
