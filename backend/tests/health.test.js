const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const { resetDatabase, getAdminToken, closePool } = require("./helpers");

after(async () => {
  await closePool();
});

test("saglik ucu veritabanina baglandigini bildirir", async () => {
  await resetDatabase();

  const response = await request(app).get("/saglik").expect(200);

  assert.equal(response.body.durum, "ok");
  assert.equal(response.body.veritabani, "bagli");
});

test("token olmadan korumali uca erisilemez", async () => {
  const response = await request(app).get("/urunler").expect(401);

  assert.ok(response.body.hata);
});

test("ilk kullanici admin olur ve giris yapabilir", async () => {
  await resetDatabase();

  const token = await getAdminToken(app);

  assert.ok(token);

  await request(app)
    .get("/urunler")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
});

test("kurulum ucu ilk kullanici olusana kadar kurulum bildirir", async () => {
  await resetDatabase();

  const once = await request(app).get("/auth/kurulum").expect(200);
  assert.equal(once.body.ilkKurulum, true, "bos veritabaninda kurulum gerekli");

  await request(app)
    .post("/auth/kayit")
    .send({ ad: "Test Admin", email: "admin@test.local", sifre: "test1234" })
    .expect(201);

  const sonra = await request(app).get("/auth/kurulum").expect(200);
  assert.equal(sonra.body.ilkKurulum, false, "kullanici varken kurulum bitmis");
});

test("saglik ucu sunucu ve veritabani saatini birlikte bildirir", async () => {
  const yanit = await request(app).get("/saglik").expect(200);

  assert.ok(yanit.body.sunucu_saati, "sunucu saati bildirilmeli");
  assert.ok(yanit.body.veritabani_saati, "veritabani saati bildirilmeli");
  assert.ok(yanit.body.sunucu_dilimi, "sunucu dilimi bildirilmeli");
  assert.ok(yanit.body.veritabani_dilimi, "veritabani dilimi bildirilmeli");

  const oku = (metin) => new Date(metin.replace(" ", "T")).getTime();
  const fark = Math.abs(
    oku(yanit.body.sunucu_saati) - oku(yanit.body.veritabani_saati),
  );

  assert.ok(
    fark < 60_000,
    `sunucu ve veritabani saati ${Math.round(fark / 1000)} saniye ayrisiyor`,
  );
});

test("gelistirme ortaminda sahte X-Forwarded-For basligina guvenilmez", async () => {
  const yanit = await request(app)
    .get("/saglik")
    .set("X-Forwarded-For", "1.2.3.4")
    .expect(200);

  assert.ok(yanit.body.istemci_ip, "istemci adresi bildirilmeli");
  assert.notEqual(
    yanit.body.istemci_ip,
    "1.2.3.4",
    "vekil guveni acikken istemci kendi adresini uydurabilir",
  );
});
