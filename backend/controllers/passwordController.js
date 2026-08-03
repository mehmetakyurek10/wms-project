const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const MIN_LENGTH = 6;

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.kullanici.id;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ hata: "Mevcut şifre ve yeni şifre zorunludur" });
    }

    if (typeof newPassword !== "string" || newPassword.length < MIN_LENGTH) {
      return res
        .status(400)
        .json({ hata: `Yeni şifre en az ${MIN_LENGTH} karakter olmalıdır` });
    }

    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json({ hata: "Yeni şifre mevcut şifreyle aynı olamaz" });
    }

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

    const token = jwt.sign(
      { id: userId, rol: user.rol, tv: guncel[0].token_surumu },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    res.json({ mesaj: "Şifreniz güncellendi", token });
  } catch (err) {
    next(err);
  }
};

module.exports = { changePassword };
