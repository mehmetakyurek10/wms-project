const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const {
  createAccessToken,
  createRefreshToken,
  setRefreshCookie,
} = require("../utils/tokens");

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.kullanici.id;

    const [rows] = await pool.query(
      "SELECT id, rol, sifre_hash, aktif FROM kullanicilar WHERE id = ?",
      [userId],
    );

    if (!rows.length) {
      return res.status(404).json({ hata: "Kullanıcı bulunamadı" });
    }

    const user = rows[0];

    if (!user.aktif) {
      return res.status(403).json({ hata: "Hesabınız pasif durumda" });
    }

    const isCurrentValid = await bcrypt.compare(
      currentPassword,
      user.sifre_hash,
    );

    if (!isCurrentValid) {
      return res.status(401).json({ hata: "Mevcut şifre hatalı" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    const [result] = await pool.query(
      `UPDATE kullanicilar
       SET sifre_hash = ?, token_surumu = token_surumu + 1
       WHERE id = ?`,
      [newHash, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ hata: "Kullanıcı bulunamadı" });
    }

    const [guncel] = await pool.query(
      "SELECT token_surumu FROM kullanicilar WHERE id = ?",
      [userId],
    );

    const kullanici = {
      id: userId,
      rol: user.rol,
      token_surumu: guncel[0].token_surumu,
    };

    setRefreshCookie(res, createRefreshToken(kullanici));

    res.json({
      mesaj: "Şifreniz güncellendi",
      token: createAccessToken(kullanici),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { changePassword };
