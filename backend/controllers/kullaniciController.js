const pool = require("../config/db");
const ALANLAR = ["rol", "aktif"];

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
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { rol, aktif } = req.body;
    const hedefId = parseInt(id, 10);

    if (!Number.isInteger(hedefId)) {
      return res.status(400).json({ hata: "Geçersiz kullanıcı" });
    }

    if (hedefId === req.kullanici.id) {
      return res.status(400).json({
        hata: "Kendi rolünüzü veya durumunuzu değiştiremezsiniz",
      });
    }

    if (rol !== undefined && !["admin", "depo_sorumlusu"].includes(rol)) {
      return res.status(400).json({ hata: "Geçersiz rol" });
    }

    const guncellenecek = {};
    if (rol !== undefined) guncellenecek.rol = rol;
    if (aktif !== undefined) guncellenecek.aktif = Boolean(aktif);

    const anahtarlar = Object.keys(guncellenecek).filter((a) =>
      ALANLAR.includes(a),
    );

    if (!anahtarlar.length) {
      return res.status(400).json({ hata: "Güncellenecek alan gönderilmedi" });
    }

    await connection.beginTransaction();

    const [hedefRows] = await connection.query(
      "SELECT id, rol, aktif FROM kullanicilar WHERE id = ? FOR UPDATE",
      [hedefId],
    );

    if (!hedefRows.length) {
      await connection.rollback();
      return res.status(404).json({ hata: "Kullanıcı bulunamadı" });
    }

    const hedef = hedefRows[0];
    const adminKalmayacak =
      hedef.rol === "admin" &&
      hedef.aktif &&
      ((anahtarlar.includes("rol") && guncellenecek.rol !== "admin") ||
        (anahtarlar.includes("aktif") && guncellenecek.aktif === false));

    if (adminKalmayacak) {
      const [adminSayim] = await connection.query(
        "SELECT COUNT(*) AS adet FROM kullanicilar WHERE rol = 'admin' AND aktif = TRUE",
      );

      if (Number(adminSayim[0].adet) <= 1) {
        await connection.rollback();
        return res.status(409).json({
          hata: "Sistemdeki son yönetici pasife alınamaz veya rolü değiştirilemez",
        });
      }
    }

    const setIfadesi = anahtarlar.map((a) => `${a} = ?`).join(", ");
    const degerler = anahtarlar.map((a) => guncellenecek[a]);

    await connection.query(
      `UPDATE kullanicilar SET ${setIfadesi} WHERE id = ?`,
      [...degerler, hedefId],
    );

    await connection.commit();

    res.json({ mesaj: "Kullanıcı güncellendi" });
  } catch (err) {
    await connection.rollback().catch(() => {});
    next(err);
  } finally {
    connection.release();
  }
};

module.exports = { listele, guncelle };
