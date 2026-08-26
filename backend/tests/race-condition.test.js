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

test("ayni siparis iki kez teslim alinamaz (yaris durumu)", async () => {
  await resetDatabase();
  const token = await getAdminToken(app);
  const { varyantId, kabulId, tedarikciId } = await seedWarehouse(app, token);

  const auth = (istek) => istek.set("Authorization", `Bearer ${token}`);

  const siparis = await auth(request(app).post("/satinalma-siparisleri"))
    .send({
      tedarikci_id: tedarikciId,
      kalemler: [{ varyant_id: varyantId, miktar: 100, birim_fiyat: 50 }],
    })
    .expect(201);

  const siparisId = siparis.body.id;

  const teslimAl = () =>
    auth(
      request(app).patch(`/satinalma-siparisleri/${siparisId}/teslim-al`),
    ).send({ lokasyon_id: kabulId });

  const [birinci, ikinci] = await Promise.all([teslimAl(), teslimAl()]);

  const kodlar = [birinci.status, ikinci.status].sort((a, b) => a - b);

  assert.equal(
    kodlar[0],
    200,
    `Isteklerden biri basarili olmaliydi. Donen kodlar: ${kodlar.join(", ")}`,
  );
  assert.ok(
    kodlar[1] === 400 || kodlar[1] === 409,
    `Ikinci istek reddedilmeliydi (400 ya da 409). Donen kodlar: ${kodlar.join(", ")}`,
  );

  const { variantTotal, unitTotal } = await stockTotals();

  assert.equal(
    variantTotal,
    100,
    `Stok bir kez artmaliydi. Bulunan: ${variantTotal}`,
  );
  assert.equal(
    unitTotal,
    variantTotal,
    "Birim toplami varyant toplamiyla uyusmuyor",
  );

  const hareketler = await auth(
    request(app).get("/stok-hareketleri?sebep=satinalma"),
  ).expect(200);

  assert.equal(
    parseInt(hareketler.headers["x-toplam-kayit"], 10),
    1,
    "Deftere tek hareket yazilmaliydi",
  );
});

test("teslim alinmis siparis tekrar teslim alinamaz", async () => {
  await resetDatabase();
  const token = await getAdminToken(app);
  const { varyantId, kabulId, tedarikciId } = await seedWarehouse(app, token);

  const auth = (istek) => istek.set("Authorization", `Bearer ${token}`);

  const siparis = await auth(request(app).post("/satinalma-siparisleri"))
    .send({
      tedarikci_id: tedarikciId,
      kalemler: [{ varyant_id: varyantId, miktar: 40, birim_fiyat: 50 }],
    })
    .expect(201);

  await auth(
    request(app).patch(`/satinalma-siparisleri/${siparis.body.id}/teslim-al`),
  )
    .send({ lokasyon_id: kabulId })
    .expect(200);

  await auth(
    request(app).patch(`/satinalma-siparisleri/${siparis.body.id}/teslim-al`),
  )
    .send({ lokasyon_id: kabulId })
    .expect(400);

  const { variantTotal } = await stockTotals();
  assert.equal(variantTotal, 40);
});

test("es zamanli iki sefer acma isteginden yalnizca biri gecer", async () => {
  await resetDatabase();
  const token = await getAdminToken(app);
  const { varyantId, kabulId } = await seedWarehouse(app, token);

  const auth = (istek) => istek.set("Authorization", `Bearer ${token}`);

  const pazar = await auth(request(app).post("/lokasyonlar"))
    .send({ kod: "TEST-PAZAR", tip: "pazar", satir: 1, kolon: 3, kapasite: 0 })
    .expect(201);

  await auth(request(app).post("/stok-hareketleri"))
    .send({
      varyant_id: varyantId,
      lokasyon_id: kabulId,
      tip: "giris",
      sebep: "satinalma",
      miktar: 100,
    })
    .expect(201);

  const birimler = await auth(
    request(app).get(`/stok-birimleri?varyant_id=${varyantId}`),
  ).expect(200);

  const dokme = birimler.body.find((b) => b.lokasyon_id === kabulId);

  // Bilerek senkron: supertest'in zincirlenebilir istek nesnesi gerekiyor.
  const seferAc = () =>
    auth(request(app).post("/pazar-seferleri")).send({
      lokasyon_id: pazar.body.id,
      kalemler: [{ varyant_id: varyantId, miktar: 40 }],
      tahsisler: [{ birim_id: dokme.id, miktar: 40 }],
    });

  const [birinci, ikinci] = await Promise.all([seferAc(), seferAc()]);

  const kodlar = [birinci.status, ikinci.status].sort((a, b) => a - b);

  assert.equal(
    kodlar[0],
    201,
    `Isteklerden biri basarili olmaliydi. Donen kodlar: ${kodlar.join(", ")}`,
  );
  assert.ok(
    kodlar[1] === 409 || kodlar[1] === 400,
    `Ikinci istek anlamli bir hatayla reddedilmeliydi, 500 donmemeli. Donen kodlar: ${kodlar.join(", ")}`,
  );

  const seferler = await auth(request(app).get("/pazar-seferleri")).expect(200);

  assert.equal(seferler.body.length, 1, "yalnizca tek sefer olusmali");

  const { variantTotal, unitTotal } = await stockTotals();

  assert.equal(unitTotal, variantTotal, "yaris sonrasi denge bozulmamali");
  assert.equal(variantTotal, 100, "toplam stok degismemeli");
});
