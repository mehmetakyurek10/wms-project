const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const { resetDatabase, closePool } = require("./helpers");

let adminToken;
let depoToken;

// Kurulum bir kez calisiyor: giris ucundaki 15 dakika / 10 deneme sinirini
// asmamak icin bu dosyada toplam iki giris yapiliyor.
before(async () => {
  await resetDatabase();

  await request(app)
    .post("/auth/kayit")
    .send({ ad: "Test Admin", email: "admin@test.local", sifre: "test1234" })
    .expect(201);

  const admin = await request(app)
    .post("/auth/giris")
    .send({ email: "admin@test.local", sifre: "test1234" })
    .expect(200);

  adminToken = admin.body.token;

  await request(app)
    .post("/auth/kayit")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      ad: "Test Depocu",
      email: "depo@test.local",
      sifre: "test1234",
      rol: "depo_sorumlusu",
    })
    .expect(201);

  const depo = await request(app)
    .post("/auth/giris")
    .send({ email: "depo@test.local", sifre: "test1234" })
    .expect(200);

  depoToken = depo.body.token;
});

after(async () => {
  await closePool();
});

const KORUMALI_UCLAR = [
  "/urunler",
  "/kategoriler",
  "/varyantlar",
  "/lokasyonlar",
  "/musteriler",
  "/tedarikciler",
  "/stok-hareketleri",
  "/stok-birimleri",
  "/satis-siparisleri",
  "/satinalma-siparisleri",
  "/transferler",
  "/raporlar/gunluk",
  "/panel/grafikler",
  "/kullanicilar",
  "/sistem/kontroller",
  "/lokasyonlar/tutarlilik",
];

const ADMIN_UCLARI = [
  "/kullanicilar",
  "/sistem/kontroller",
  "/lokasyonlar/tutarlilik",
];

const HERKESE_ACIK_UCLAR = [
  "/urunler",
  "/kategoriler",
  "/varyantlar",
  "/lokasyonlar",
  "/musteriler",
  "/tedarikciler",
  "/stok-hareketleri",
  "/stok-birimleri",
  "/satis-siparisleri",
  "/satinalma-siparisleri",
  "/transferler",
  "/panel/grafikler",
];

test("token olmadan hicbir korumali uca erisilemez", async () => {
  for (const uc of KORUMALI_UCLAR) {
    const yanit = await request(app).get(uc);
    assert.equal(yanit.status, 401, `${uc} tokensiz erisime acik`);
  }
});

test("gecersiz token reddedilir", async () => {
  const yanit = await request(app)
    .get("/urunler")
    .set("Authorization", "Bearer sahte.token.degeri")
    .expect(401);

  assert.ok(yanit.body.hata);
});

test("depo sorumlusu admin uclarina erisemez", async () => {
  for (const uc of ADMIN_UCLARI) {
    const yanit = await request(app)
      .get(uc)
      .set("Authorization", `Bearer ${depoToken}`);

    assert.equal(yanit.status, 403, `${uc} depo sorumlusuna acik`);
  }
});

test("depo sorumlusu admin gerektiren yazma islemlerini yapamaz", async () => {
  const silme = await request(app)
    .delete("/urunler/999999")
    .set("Authorization", `Bearer ${depoToken}`);
  assert.equal(silme.status, 403);

  const blok = await request(app)
    .post("/lokasyonlar/blok-olustur")
    .set("Authorization", `Bearer ${depoToken}`)
    .send({ blok: "T", sira_sayisi: 1, derinlik: 1, kat: 1 });
  assert.equal(blok.status, 403);

  const kayit = await request(app)
    .post("/auth/kayit")
    .set("Authorization", `Bearer ${depoToken}`)
    .send({ ad: "Sahte", email: "sahte@test.local", sifre: "test1234" });
  assert.equal(kayit.status, 403, "yetki yukseltme engellenmeli");
});

test("depo sorumlusu gunluk islem uclarina erisebilir", async () => {
  for (const uc of HERKESE_ACIK_UCLAR) {
    const yanit = await request(app)
      .get(uc)
      .set("Authorization", `Bearer ${depoToken}`);

    assert.notEqual(yanit.status, 401, `${uc} depo sorumlusuna kapali`);
    assert.notEqual(yanit.status, 403, `${uc} depo sorumlusuna kapali`);
  }
});

test("admin butun uclara erisebilir", async () => {
  for (const uc of KORUMALI_UCLAR) {
    const yanit = await request(app)
      .get(uc)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(yanit.status, 200, `${uc} admin'e kapali`);
  }
});
