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
