const pool = require("../config/db");
const { buildPagination } = require("../utils/pagination");

const listele = async (req, res, next) => {
  try {
    const { varyant_id, tip, sebep, baslangic, bitis } = req.query;
    const { limit, offset } = buildPagination(req.query, 20);

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

    const sorgu =
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
      " ORDER BY sh.tarih DESC LIMIT ? OFFSET ?";

    const [rows] = await pool.query(sorgu, [...kosulDegerleri, limit, offset]);
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
      toptan_fiyat,
      perakende_fiyat,
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO urun_varyantlari
       (urun_id, boy, ambalaj_tipi, ambalaj_kg, barkod, miktar, kritik_seviye,
        toptan_fiyat, perakende_fiyat)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        urun_id,
        boy,
        ambalaj_tipi || "kova",
        ambalaj_kg || 10,
        barkod || null,
        miktar || 0,
        kritik_seviye || 0,
        toptan_fiyat || 0,
        perakende_fiyat || 0,
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
      toptan_fiyat,
      perakende_fiyat,
      aktif,
    } = req.body;

    const [sonuc] = await pool.query(
      `UPDATE urun_varyantlari
       SET boy=?, ambalaj_tipi=?, ambalaj_kg=?, barkod=?, kritik_seviye=?,
           toptan_fiyat=?, perakende_fiyat=?, aktif=?
       WHERE id=?`,
      [
        boy,
        ambalaj_tipi,
        ambalaj_kg,
        barkod || null,
        kritik_seviye,
        toptan_fiyat ?? 0,
        perakende_fiyat ?? 0,
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
      return res.status(409).json({
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

const varyantLokasyonlari = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT sb.lokasyon_id, sb.miktar, sb.tip AS birim_tipi, sb.kod AS birim_kodu,
              l.kod, l.ad, l.tip, l.blok, l.sira, l.derinlik, l.kat
       FROM stok_birimleri sb
       JOIN lokasyonlar l ON sb.lokasyon_id = l.id
       WHERE sb.varyant_id = ? AND sb.miktar > 0
       ORDER BY l.kod`,
      [id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listele,
  dusukStok,
  ekle,
  guncelle,
  sil,
  varyantLokasyonlari,
};
