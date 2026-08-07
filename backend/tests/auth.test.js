const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const { resetDatabase, closePool } = require("./helpers");

const EMAIL = "admin@test.local";
const SIFRE = "test1234";

after(async () => {
  await closePool();
});

function cerezSatiri(yanit) {
  const basliklar = yanit.headers["set-cookie"] || [];
  return basliklar.find((c) => c.startsWith("wms_refresh=")) || null;
}

function cerezDegeri(yanit) {
  const satir = cerezSatiri(yanit);
  if (!satir) return null;
  const deger = satir.split(";")[0].slice("wms_refresh=".length);
  return deger || null;
}

// Giris ucunda 15 dakikada 10 deneme siniri var ve sayac bellekte tutuluyor.
// Bu dosyadaki her test tam olarak bir giris yapiyor; test eklerken bu
// butceyi asma, yoksa son testler 429 alir.
async function girisYap() {
  await resetDatabase();

  await request(app)
    .post("/auth/kayit")
    .send({ ad: "Test Admin", email: EMAIL, sifre: SIFRE })
    .expect(201);

  return request(app)
    .post("/auth/giris")
    .send({ email: EMAIL, sifre: SIFRE })
    .expect(200);
}

test("giris httpOnly refresh cerezi basar ve access token doner", async () => {
  const yanit = await girisYap();

  assert.ok(yanit.body.token, "govdede access token olmali");
  assert.equal(yanit.body.kullanici.email, EMAIL);
  assert.ok(
    !JSON.stringify(yanit.body).includes("wms_refresh"),
    "refresh token govdede sizmamali",
  );

  const satir = cerezSatiri(yanit);
  assert.ok(satir, "wms_refresh cerezi basilmali");
  assert.match(satir, /HttpOnly/i, "cerez JavaScript'ten okunamamali");
  assert.match(satir, /Path=\/auth/i, "cerez yalnizca /auth altina gitmeli");
  assert.match(
    satir,
    /SameSite=Lax/i,
    "capraz site isteklerinde gonderilmemeli",
  );
});

test("refresh token API isteginde kabul edilmez", async () => {
  const yanit = await girisYap();
  const refresh = cerezDegeri(yanit);

  const hatali = await request(app)
    .get("/urunler")
    .set("Authorization", `Bearer ${refresh}`)
    .expect(401);

  assert.match(hatali.body.hata, /tür/i, "tip claim'i devrede olmali");
});

test("access token yenileme ucunda kabul edilmez", async () => {
  const yanit = await girisYap();
  const access = yanit.body.token;

  const hatali = await request(app)
    .post("/auth/yenile")
    .set("Cookie", `wms_refresh=${access}`)
    .expect(401);

  assert.match(hatali.body.hata, /tür/i);
});

test("yenileme yeni access token ve kullanici bilgisi doner", async () => {
  const yanit = await girisYap();
  const refresh = cerezDegeri(yanit);

  const yeni = await request(app)
    .post("/auth/yenile")
    .set("Cookie", `wms_refresh=${refresh}`)
    .expect(200);

  assert.ok(yeni.body.token);
  assert.equal(yeni.body.kullanici.email, EMAIL);

  await request(app)
    .get("/urunler")
    .set("Authorization", `Bearer ${yeni.body.token}`)
    .expect(200);
});

test("yenilemede refresh cerezi dondurulur (rotation)", async () => {
  const yanit = await girisYap();
  const ilkRefresh = cerezDegeri(yanit);

  // JWT'nin iat alani saniye cozunurluklu. Ayni saniye icinde uretilen iki
  // token birebir ayni cikar ve bu test yanlis yere basarisiz olur.
  await new Promise((cozumle) => setTimeout(cozumle, 1100));

  const yeni = await request(app)
    .post("/auth/yenile")
    .set("Cookie", `wms_refresh=${ilkRefresh}`)
    .expect(200);

  const ikinciRefresh = cerezDegeri(yeni);

  assert.ok(ikinciRefresh, "yenilemede yeni cerez basilmali");
  assert.notEqual(ikinciRefresh, ilkRefresh, "refresh token dondurulmeli");
});

test("cerez olmadan yenileme reddedilir", async () => {
  await resetDatabase();

  const yanit = await request(app).post("/auth/yenile").expect(401);

  assert.ok(yanit.body.hata);
});

test("cikis cerezi siler ve yenileme artik calismaz", async () => {
  const yanit = await girisYap();
  const refresh = cerezDegeri(yanit);

  const cikis = await request(app)
    .post("/auth/cikis")
    .set("Cookie", `wms_refresh=${refresh}`)
    .expect(200);

  assert.equal(cerezDegeri(cikis), null, "cikis cerezi bos degerle ezmeli");

  // Tarayici cerezi sildigi icin sonraki yenileme cerezsiz gelir.
  await request(app).post("/auth/yenile").expect(401);
});

test("sifre degisince eski access token gecersizlesir", async () => {
  const yanit = await girisYap();
  const eskiAccess = yanit.body.token;

  const degisim = await request(app)
    .patch("/hesap/sifre")
    .set("Authorization", `Bearer ${eskiAccess}`)
    .send({ currentPassword: SIFRE, newPassword: "yeni12345" })
    .expect(200);

  assert.ok(degisim.body.token, "kullanicinin kendi oturumu dusmemeli");

  // Eski token'in tv claim'i artik guncel degil.
  await request(app)
    .get("/urunler")
    .set("Authorization", `Bearer ${eskiAccess}`)
    .expect(401);

  // Yeni token calismali.
  await request(app)
    .get("/urunler")
    .set("Authorization", `Bearer ${degisim.body.token}`)
    .expect(200);

  // Sifre degisiminde basilan yeni refresh cerezi de gecerli olmali.
  const yeniRefresh = cerezDegeri(degisim);
  assert.ok(yeniRefresh, "sifre degisiminde yeni refresh cerezi basilmali");

  await request(app)
    .post("/auth/yenile")
    .set("Cookie", `wms_refresh=${yeniRefresh}`)
    .expect(200);
});
