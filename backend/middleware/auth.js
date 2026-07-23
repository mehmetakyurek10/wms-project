const jwt = require("jsonwebtoken");

const dogrula = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ hata: "Token bulunamadı, giriş yapmalısınız" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.kullanici = payload;
    next();
  } catch (err) {
    return res.status(401).json({ hata: "Geçersiz veya süresi dolmuş token" });
  }
};

module.exports = dogrula;
