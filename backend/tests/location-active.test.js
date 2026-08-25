const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const { resetDatabase, seedWarehouse, closePool } = require("./helpers");

let adminToken;
let depoToken;
let seed;
let sayac = 100;

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
  seed = await seedWarehouse(app, adminToken);
});

after(async () => {
  await closePool();
});

const yonetici = (istek) => istek.set("Authorization", `Bearer ${adminToken}`);
const depocu = (istek) => istek.set("Authorization", `Bearer ${depoToken}`);

async function lokasyonOlustur() {
  sayac += 1;
  const kod = `TEST-${sayac}`;
  const satir = sayac;

  const yanit = await yonetici(request(app).post("/lokasyonlar"))
    .send({ kod, tip: "raf", satir, kolon: 1, kapasite: 10 })
    .expect(201);

  return { id: yanit.body.id, kod, satir };
}

function pasifeAl(id) {
  return yonetici(request(app).patch(`/lokasyonlar/${id}/aktiflik`)).send({
    aktif: false,
  });
}

async function lokasyonBul(id) {
  const liste = await yonetici(request(app).get("/lokasyonlar")).expect(200);
  return liste.body.find((l) => l.id === id);
}

test("duzenleme pasif lokasyonu sessizce diriltmez", async () => {
  const { id, kod, satir } = await lokasyonOlustur();

  await pasifeAl(id).expect(200);

  await yonetici(request(app).put(`/lokasyonlar/${id}`))
    .send({
      kod,
      ad: "Tadilattaki raf",
      tip: "raf",
      satir,
      kolon: 1,
      satir_span: 1,
      kolon_span: 1,
      kapasite: 20,
    })
    .expect(200);

  const lokasyon = await lokasyonBul(id);

  assert.equal(lokasyon.ad, "Tadilattaki raf", "duzenleme uygulanmali");
  assert.equal(Number(lokasyon.kapasite), 20);
  assert.equal(
    Number(lokasyon.aktif),
    0,
    "gonderilmeyen aktif alani lokasyonu diriltmemeli",
  );
});

test("aktiflik ucu lokasyonu pasife alir ve geri acar", async () => {
  const { id } = await lokasyonOlustur();

  const kapatma = await pasifeAl(id).expect(200);

  assert.match(kapatma.body.mesaj, /pasife alındı/);
  assert.equal(Number((await lokasyonBul(id)).aktif), 0);

  await yonetici(request(app).patch(`/lokasyonlar/${id}/aktiflik`))
    .send({ aktif: true })
    .expect(200);

  assert.equal(Number((await lokasyonBul(id)).aktif), 1);
});

test("pasif lokasyona stok girisi yapilamaz", async () => {
  const { id } = await lokasyonOlustur();

  await pasifeAl(id).expect(200);

  await yonetici(request(app).post("/stok-hareketleri"))
    .send({
      varyant_id: seed.varyantId,
      lokasyon_id: id,
      tip: "giris",
      sebep: "satinalma",
      miktar: 10,
    })
    .expect(404);
});

test("stoklu lokasyon pasife alinabilir ama kullanici uyarilir", async () => {
  const { id } = await lokasyonOlustur();

  await yonetici(request(app).post("/stok-hareketleri"))
    .send({
      varyant_id: seed.varyantId,
      lokasyon_id: id,
      tip: "giris",
      sebep: "satinalma",
      miktar: 25,
    })
    .expect(201);

  const yanit = await pasifeAl(id).expect(200);

  assert.match(
    yanit.body.mesaj,
    /25 adet stok/,
    "uzerinde stok kalan lokasyon pasife alinirken miktar bildirilmeli",
  );
  assert.equal(Number((await lokasyonBul(id)).aktif), 0);
});

test("aktiflik degeri gercek boolean olmali", async () => {
  const { id } = await lokasyonOlustur();

  await yonetici(request(app).patch(`/lokasyonlar/${id}/aktiflik`))
    .send({ aktif: "false" })
    .expect(400);

  assert.equal(
    Number((await lokasyonBul(id)).aktif),
    1,
    "reddedilen istek durumu degistirmemeli",
  );
});

test("depo sorumlusu lokasyonu pasife alamaz", async () => {
  const { id } = await lokasyonOlustur();

  const yanit = await depocu(request(app).patch(`/lokasyonlar/${id}/aktiflik`))
    .send({ aktif: false })
    .expect(403);

  assert.match(yanit.body.hata, /yetkiniz yok/i);
});

test("olmayan lokasyonun aktifligi degistirilemez", async () => {
  await yonetici(request(app).patch("/lokasyonlar/999999/aktiflik"))
    .send({ aktif: false })
    .expect(404);
});
