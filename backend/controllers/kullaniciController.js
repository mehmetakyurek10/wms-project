const pool = require("../config/db");

const listele = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, ad, email, rol, aktif, olusturulma_tarihi
       FROM kullanicilar
       ORDER BY ad`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const guncelle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rol, aktif } = req.body;

    if (parseInt(id, 10) === req.kullanici.id) {
      return res.status(400).json({
        hata: "Kendi rolünüzü veya durumunuzu değiştiremezsiniz",
      });
    }

    if (rol && !["admin", "depo_sorumlusu"].includes(rol)) {
      return res.status(400).json({ hata: "Geçersiz rol" });
    }

    const [sonuc] = await pool.query(
      "UPDATE kullanicilar SET rol = ?, aktif = ? WHERE id = ?",
      [rol, aktif, id],
    );

    if (sonuc.affectedRows === 0) {
      return res.status(404).json({ hata: "Kullanıcı bulunamadı" });
    }

    res.json({ mesaj: "Kullanıcı güncellendi" });
  } catch (err) {
    next(err);
  }
};

module.exports = { listele, guncelle };
