const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const dogrula = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ hata: "Token bulunamadı, giriş yapmalısınız" });
  }

  const token = authHeader.split(" ")[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ hata: "Geçersiz veya süresi dolmuş token" });
  }

  if (payload.tip !== "access") {
    return res.status(401).json({ hata: "Geçersiz token türü" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT token_surumu FROM kullanicilar WHERE id = ?",
      [payload.id],
    );

    if (!rows.length) {
      return res.status(401).json({ hata: "Kullanıcı bulunamadı" });
    }

    if (rows[0].token_surumu !== payload.tv) {
      return res
        .status(401)
        .json({ hata: "Oturumunuz sonlandırıldı, tekrar giriş yapın" });
    }

    req.kullanici = payload;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = dogrula;
