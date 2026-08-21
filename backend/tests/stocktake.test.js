const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const {
  resetDatabase,
  getAdminToken,
  seedWarehouse,
  stockTotals,
  closePool,
} = require("./helpers");

after(async () => {
  await closePool();
});

async function hazirla() {
  await resetDatabase();
  const token = await getAdminToken(app);
  const seed = await seedWarehouse(app, token);
  const auth = (istek) => istek.set("Authorization", `Bearer ${token}`);

  await auth(request(app).post("/stok-hareketleri"))
    .send({
      varyant_id: seed.varyantId,
      lokasyon_id: seed.kabulId,
      tip: "giris",
      sebep: "satinalma",
      miktar: 100,
    })
    .expect(201);

  const birimler = await auth(
    request(app).get(`/stok-birimleri?varyant_id=${seed.varyantId}`),
  ).expect(200);

  return { ...seed, auth, dokme: birimler.body[0] };
}

test("farkli sayim kaydediliyor ve urettigi harekete bagli", async () => {
  const { auth, kabulId, dokme } = await hazirla();

  const sayim = await auth(request(app).post("/sayim"))
    .send({
      lokasyon_id: kabulId,
      aciklama: "Yil sonu sayimi",
      kalemler: [{ birim_id: dokme.id, sayilan_miktar: 80 }],
    })
    .expect(200);

  assert.ok(sayim.body.sayim_id, "yanitta sayim kimligi donmeli");

  const gecmis = await auth(request(app).get("/sayim")).expect(200);

  assert.equal(gecmis.body.length, 1);
  assert.equal(gecmis.body[0].sayilan_kalem, 1);
  assert.equal(gecmis.body[0].farkli_kalem, 1);
  assert.equal(Number(gecmis.body[0].net_fark), -20);
  assert.equal(gecmis.body[0].aciklama, "Yil sonu sayimi");
  assert.ok(gecmis.body[0].kullanici_adi, "sayimi yapan kisi kayitli olmali");

  const detay = await auth(
    request(app).get(`/sayim/${sayim.body.sayim_id}`),
  ).expect(200);

  assert.equal(
    detay.body.hareketler.length,
    1,
    "sayimin uretttigi hareket sayim kaydina bagli olmali",
  );
  assert.equal(detay.body.hareketler[0].tip, "cikis");
  assert.equal(Number(detay.body.hareketler[0].miktar), 20);

  const { variantTotal, unitTotal } = await stockTotals();

  assert.equal(variantTotal, 80);
  assert.equal(unitTotal, variantTotal, "sayim sonrasi denge bozulmamali");
});

test("fark cikmayan sayim da kaydediliyor", async () => {
  const { auth, kabulId, dokme } = await hazirla();

  await auth(request(app).post("/sayim"))
    .send({
      lokasyon_id: kabulId,
      kalemler: [{ birim_id: dokme.id, sayilan_miktar: 100 }],
    })
    .expect(200);

  const gecmis = await auth(request(app).get("/sayim")).expect(200);

  assert.equal(
    gecmis.body.length,
    1,
    "fark olmasa da lokasyonun sayildigi kayit altina alinmali",
  );
  assert.equal(gecmis.body[0].farkli_kalem, 0);
  assert.equal(Number(gecmis.body[0].net_fark), 0);

  const detay = await auth(
    request(app).get(`/sayim/${gecmis.body[0].id}`),
  ).expect(200);

  assert.equal(
    detay.body.hareketler.length,
    0,
    "fark yoksa stok hareketi yazilmamali",
  );
});

test("sayim gecmisi duruma gore suzuluyor", async () => {
  const { auth, kabulId, dokme } = await hazirla();

  await auth(request(app).post("/sayim"))
    .send({
      lokasyon_id: kabulId,
      kalemler: [{ birim_id: dokme.id, sayilan_miktar: 80 }],
    })
    .expect(200);

  await auth(request(app).post("/sayim"))
    .send({
      lokasyon_id: kabulId,
      kalemler: [{ birim_id: dokme.id, sayilan_miktar: 80 }],
    })
    .expect(200);

  const hepsi = await auth(request(app).get("/sayim")).expect(200);
  assert.equal(hepsi.body.length, 2);
  assert.equal(hepsi.headers["x-toplam-kayit"], "2");

  const uyumlu = await auth(request(app).get("/sayim?durum=uyumlu")).expect(
    200,
  );
  assert.equal(uyumlu.body.length, 1);
  assert.equal(uyumlu.body[0].farkli_kalem, 0);
  assert.equal(uyumlu.headers["x-toplam-kayit"], "1");

  const farkli = await auth(request(app).get("/sayim?durum=farkli")).expect(
    200,
  );
  assert.equal(farkli.body.length, 1);
  assert.equal(farkli.body[0].farkli_kalem, 1);
});

test("olmayan sayim 404 doner", async () => {
  const { auth } = await hazirla();

  await auth(request(app).get("/sayim/999999")).expect(404);
});
