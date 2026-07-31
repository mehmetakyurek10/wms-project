const pool = require("../config/db");
const dogrula = require("./auth");
const izinVer = require("./izinVer");

async function kayitKorumasi(req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT COUNT(*) AS adet FROM kullanicilar",
    );

    if (rows[0].adet === 0) {
      req.ilkKurulum = true;
      return next();
    }

    dogrula(req, res, (hata) => {
      if (hata) return next(hata);
      izinVer("admin")(req, res, next);
    });
  } catch (err) {
    next(err);
  }
}

module.exports = kayitKorumasi;
