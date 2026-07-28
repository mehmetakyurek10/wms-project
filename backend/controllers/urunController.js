const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const { ara, kategori_id, sayfa, limit } = req.query;

    let kosul = " WHERE 1=1";
    const kosulDegerleri = [];

    if (ara) {
      kosul += " AND ad LIKE ?";
      kosulDegerleri.push(`%${ara}%`);
    }

    if (kategori_id) {
      kosul += " AND kategori_id = ?";
      kosulDegerleri.push(kategori_id);
    }

    const [sayim] = await pool.query(
      "SELECT COUNT(*) AS toplam FROM urunler" + kosul,
      kosulDegerleri,
    );
    res.set("X-Toplam-Kayit", sayim[0].toplam);

    let sorgu = "SELECT * FROM urunler" + kosul;
    const degerler = [...kosulDegerleri];

    if (sayfa || limit) {
      const sayfaNo = parseInt(sayfa, 10) || 1;
      const limitSayi = parseInt(limit, 10) || 10;
      const offset = (sayfaNo - 1) * limitSayi;
      sorgu += " ORDER BY id LIMIT ? OFFSET ?";
      degerler.push(limitSayi, offset);
    } else {
      sorgu += " ORDER BY id";
    }

    const [rows] = await pool.query(sorgu, degerler);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const getirTek = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM urunler WHERE id=?", [id]);

    if (!rows.length) {
      return res.status(404).json({ hata: "Ürün bulunamadı" });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const ekle = async (req, res, next) => {
  try {
    const { ad, kategori_id, miktar, birim, kritik_seviye } = req.body;

    if (!ad || !birim) {
      return res.status(400).json({ hata: "Ürün adı ve birim zorunludur" });
    }

    const [result] = await pool.query(
      "INSERT INTO urunler (ad, kategori_id, miktar, birim, kritik_seviye) VALUES (?, ?, ?, ?, ?)",
      [ad, kategori_id, miktar || 0, birim, kritik_seviye || 0],
    );
    res.status(201).json({
      id: result.insertId,
      ad,
      kategori_id,
      miktar,
      birim,
      kritik_seviye,
    });
  } catch (err) {
    next(err);
  }
};

const guncelle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ad, kategori_id, miktar, birim, kritik_seviye } = req.body;
    await pool.query(
      "UPDATE urunler SET ad=?, kategori_id=?, miktar=?, birim=?, kritik_seviye=? WHERE id=?",
      [ad, kategori_id, miktar, birim, kritik_seviye, id],
    );
    res.json({ mesaj: "Güncellendi" });
  } catch (err) {
    next(err);
  }
};

const dusukStok = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM urunler WHERE miktar <= kritik_seviye",
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const sil = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM urunler WHERE id=?", [id]);
    res.json({ mesaj: "Silindi" });
  } catch (err) {
    next(err);
  }
};

module.exports = { listele, ekle, guncelle, sil, dusukStok, getirTek };
