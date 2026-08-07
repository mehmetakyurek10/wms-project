const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  createAccessToken,
  createRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshCookie,
} = require("../utils/tokens");

const GECERLI_ROLLER = ["admin", "depo_sorumlusu"];

const kayitOl = async (req, res, next) => {
  try {
    const { ad, email, sifre, rol } = req.body;

    if (!ad || !email || !sifre) {
      return res.status(400).json({ hata: "Ad, email ve şifre zorunludur" });
    }

    if (sifre.length < 6) {
      return res.status(400).json({ hata: "Şifre en az 6 karakter olmalıdır" });
    }

    let atanacakRol = "depo_sorumlusu";

    if (req.ilkKurulum) {
      atanacakRol = "admin";
    } else if (rol) {
      if (!GECERLI_ROLLER.includes(rol)) {
        return res.status(400).json({ hata: "Geçersiz rol" });
      }
      atanacakRol = rol;
    }

    const sifre_hash = await bcrypt.hash(sifre, 10);

    const [result] = await pool.query(
      "INSERT INTO kullanicilar (ad, email, sifre_hash, rol) VALUES (?, ?, ?, ?)",
      [ad, email, sifre_hash, atanacakRol],
    );

    res.status(201).json({ id: result.insertId, ad, email, rol: atanacakRol });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ hata: "Bu email zaten kayıtlı" });
    }
    next(err);
  }
};

const girisYap = async (req, res, next) => {
  try {
    const { email, sifre } = req.body;

    if (!email || !sifre) {
      return res.status(400).json({ hata: "Email ve şifre zorunludur" });
    }

    const [rows] = await pool.query(
      "SELECT id, ad, email, sifre_hash, rol, aktif, token_surumu FROM kullanicilar WHERE email = ?",
      [email],
    );

    if (!rows.length) {
      return res.status(401).json({ hata: "Email veya şifre hatalı" });
    }

    const kullanici = rows[0];
    const dogruMu = await bcrypt.compare(sifre, kullanici.sifre_hash);

    if (!dogruMu) {
      return res.status(401).json({ hata: "Email veya şifre hatalı" });
    }

    if (!kullanici.aktif) {
      return res.status(403).json({
        hata: "Hesabınız pasif durumda, yöneticinizle görüşün",
      });
    }

    setRefreshCookie(res, createRefreshToken(kullanici));

    res.json({
      token: createAccessToken(kullanici),
      kullanici: {
        id: kullanici.id,
        ad: kullanici.ad,
        email: kullanici.email,
        rol: kullanici.rol,
      },
    });
  } catch (err) {
    next(err);
  }
};

const yenile = async (req, res, next) => {
  try {
    const token = readRefreshCookie(req);

    if (!token) {
      return res.status(401).json({ hata: "Oturum bulunamadı" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      clearRefreshCookie(res);
      return res
        .status(401)
        .json({ hata: "Oturum süresi doldu, tekrar giriş yapın" });
    }

    if (payload.tip !== "refresh") {
      clearRefreshCookie(res);
      return res.status(401).json({ hata: "Geçersiz token türü" });
    }

    const [rows] = await pool.query(
      "SELECT id, ad, email, rol, aktif, token_surumu FROM kullanicilar WHERE id = ?",
      [payload.id],
    );

    if (!rows.length) {
      clearRefreshCookie(res);
      return res.status(401).json({ hata: "Kullanıcı bulunamadı" });
    }

    const kullanici = rows[0];

    if (!kullanici.aktif) {
      clearRefreshCookie(res);
      return res.status(403).json({ hata: "Hesabınız pasif durumda" });
    }

    if (kullanici.token_surumu !== payload.tv) {
      clearRefreshCookie(res);
      return res
        .status(401)
        .json({ hata: "Oturumunuz sonlandırıldı, tekrar giriş yapın" });
    }

    setRefreshCookie(res, createRefreshToken(kullanici));

    res.json({
      token: createAccessToken(kullanici),
      kullanici: {
        id: kullanici.id,
        ad: kullanici.ad,
        email: kullanici.email,
        rol: kullanici.rol,
      },
    });
  } catch (err) {
    next(err);
  }
};

const cikisYap = (req, res) => {
  clearRefreshCookie(res);
  res.json({ mesaj: "Çıkış yapıldı" });
};

module.exports = { kayitOl, girisYap, yenile, cikisYap };
