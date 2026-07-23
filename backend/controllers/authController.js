const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const kayitOl = async (req, res) => {
  try {
    const { ad, email, sifre, rol } = req.body;

    if (!ad || !email || !sifre) {
      return res.status(400).json({ hata: "Ad, email ve şifre zorunludur" });
    }

    const sifre_hash = await bcrypt.hash(sifre, 10);

    const [result] = await pool.query(
      "INSERT INTO kullanicilar (ad, email, sifre_hash, rol) VALUES (?, ?, ?, ?)",
      [ad, email, sifre_hash, rol || "depo_sorumlusu"],
    );

    res
      .status(201)
      .json({ id: result.insertId, ad, email, rol: rol || "depo_sorumlusu" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ hata: "Bu email zaten kayıtlı" });
    }
    res.status(500).json({ hata: err.message });
  }
};

const girisYap = async (req, res) => {
  try {
    const { email, sifre } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM kullanicilar WHERE email = ?",
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

    const token = jwt.sign(
      { id: kullanici.id, rol: kullanici.rol },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    res.json({
      token,
      kullanici: {
        id: kullanici.id,
        ad: kullanici.ad,
        email: kullanici.email,
        rol: kullanici.rol,
      },
    });
  } catch (err) {
    res.status(500).json({ hata: err.message });
  }
};

module.exports = { kayitOl, girisYap };
