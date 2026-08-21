const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
const request = require("supertest");
const pool = require("../config/db");

const SCHEMA_PATH = path.join(__dirname, "..", "db", "schema.sql");

async function resetDatabase() {
  if (process.env.DB_NAME !== "wms_test") {
    throw new Error(
      `Testler yalnizca wms_test veritabaninda calisir. Su anki: ${process.env.DB_NAME}`,
    );
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    multipleStatements: true,
  });

  const schema = await fs.readFile(SCHEMA_PATH, "utf8");

  await connection.query("SET FOREIGN_KEY_CHECKS = 0");
  await connection.query(schema);
  await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  await connection.end();
}

async function getAdminToken(app) {
  await request(app)
    .post("/auth/kayit")
    .send({ ad: "Test Admin", email: "admin@test.local", sifre: "test1234" })
    .expect(201);

  const response = await request(app)
    .post("/auth/giris")
    .send({ email: "admin@test.local", sifre: "test1234" })
    .expect(200);

  return response.body.token;
}

async function seedWarehouse(app, token) {
  const auth = (istek) => istek.set("Authorization", `Bearer ${token}`);

  const kategori = await auth(request(app).post("/kategoriler"))
    .send({ ad: "Test Kategori" })
    .expect(201);

  const urun = await auth(request(app).post("/urunler"))
    .send({ ad: "Test Zeytin", kategori_id: kategori.body.id })
    .expect(201);

  const varyant = await auth(request(app).post("/varyantlar"))
    .send({
      urun_id: urun.body.id,
      boy: "STANDART",
      ambalaj_tipi: "kova",
      ambalaj_kg: 10,
      miktar: 0,
      kritik_seviye: 0,
    })
    .expect(201);

  const kabul = await auth(request(app).post("/lokasyonlar"))
    .send({ kod: "TEST-KABUL", tip: "alan", satir: 1, kolon: 1, kapasite: 0 })
    .expect(201);

  const raf = await auth(request(app).post("/lokasyonlar"))
    .send({ kod: "TEST-RAF", tip: "palet", satir: 1, kolon: 2, kapasite: 5 })
    .expect(201);

  const musteri = await auth(request(app).post("/musteriler"))
    .send({ ad: "Test Musteri" })
    .expect(201);

  const tedarikci = await auth(request(app).post("/tedarikciler"))
    .send({ ad: "Test Tedarikci" })
    .expect(201);

  return {
    varyantId: varyant.body.id,
    kabulId: kabul.body.id,
    rafId: raf.body.id,
    musteriId: musteri.body.id,
    tedarikciId: tedarikci.body.id,
  };
}

async function stockTotals() {
  const [rows] = await pool.query(
    `SELECT
       (SELECT COALESCE(SUM(miktar), 0) FROM urun_varyantlari) AS variantTotal,
       (SELECT COALESCE(SUM(miktar), 0) FROM stok_birimleri)   AS unitTotal`,
  );

  return {
    variantTotal: Number(rows[0].variantTotal),
    unitTotal: Number(rows[0].unitTotal),
  };
}

async function closePool() {
  await pool.end();
}

module.exports = {
  resetDatabase,
  getAdminToken,
  seedWarehouse,
  stockTotals,
  closePool,
};
