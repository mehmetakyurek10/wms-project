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

  const birimler = async () => {
    const yanit = await auth(
      request(app).get(`/stok-birimleri?varyant_id=${seed.varyantId}`),
    ).expect(200);
    return yanit.body;
  };

  const siparisVer = (miktar, tahsisler) =>
    auth(request(app).post("/satis-siparisleri")).send({
      musteri_id: seed.musteriId,
      kalemler: [{ varyant_id: seed.varyantId, miktar, birim_fiyat: 100 }],
      tahsisler,
    });

  return { ...seed, auth, birimler, siparisVer };
}

test("rezervasyon fiziksel stoga dokunmaz, kullanilabiliri dusurur", async () => {
  const { birimler, siparisVer } = await hazirla();

  const [dokme] = await birimler();
  assert.equal(Number(dokme.miktar), 100);
  assert.equal(Number(dokme.rezerve), 0);
  assert.equal(Number(dokme.kullanilabilir), 100);

  await siparisVer(60, [{ birim_id: dokme.id, miktar: 60 }]).expect(201);

  const [sonra] = await birimler();
  assert.equal(Number(sonra.miktar), 100, "fiziksel miktar degismemeli");
  assert.equal(Number(sonra.rezerve), 60);
  assert.equal(Number(sonra.kullanilabilir), 40);

  const { variantTotal, unitTotal } = await stockTotals();
  assert.equal(unitTotal, variantTotal);
  assert.equal(variantTotal, 100, "rezervasyon toplam stogu degistirmemeli");
});

test("kullanilabilirden fazlasi rezerve edilemez", async () => {
  const { birimler, siparisVer } = await hazirla();
  const [dokme] = await birimler();

  await siparisVer(60, [{ birim_id: dokme.id, miktar: 60 }]).expect(201);

  const yanit = await siparisVer(50, [
    { birim_id: dokme.id, miktar: 50 },
  ]).expect(400);

  assert.match(yanit.body.hata, /kullanılabilir stok yok/);
});

test("tahsis toplami siparis miktariyla birebir eslesmeli", async () => {
  const { birimler, siparisVer } = await hazirla();
  const [dokme] = await birimler();

  await siparisVer(30, [{ birim_id: dokme.id, miktar: 20 }]).expect(400);
  await siparisVer(30, [{ birim_id: dokme.id, miktar: 40 }]).expect(400);
  await siparisVer(30, []).expect(400);
});

test("iptal rezervasyonu serbest birakir", async () => {
  const { birimler, siparisVer, auth } = await hazirla();
  const [dokme] = await birimler();

  const siparis = await siparisVer(60, [
    { birim_id: dokme.id, miktar: 60 },
  ]).expect(201);

  await auth(
    request(app).patch(`/satis-siparisleri/${siparis.body.id}/iptal`),
  ).expect(200);

  const [sonra] = await birimler();
  assert.equal(Number(sonra.rezerve), 0);
  assert.equal(Number(sonra.kullanilabilir), 100);
  assert.equal(Number(sonra.miktar), 100, "iptal fiziksel stoga dokunmamali");
});

test("rezerve stok cikis, paletleme ve transfer ile tuketilemez", async () => {
  const { birimler, siparisVer, auth, varyantId, kabulId, rafId } =
    await hazirla();
  const [dokme] = await birimler();

  await siparisVer(60, [{ birim_id: dokme.id, miktar: 60 }]).expect(201);

  await auth(request(app).post("/stok-hareketleri"))
    .send({ birim_id: dokme.id, tip: "cikis", sebep: "fire", miktar: 50 })
    .expect(400);

  await auth(request(app).post("/stok-birimleri/paletle"))
    .send({
      varyant_id: varyantId,
      lokasyon_id: kabulId,
      miktar: 50,
      kod: "P-REZ-TEST",
    })
    .expect(400);

  await auth(request(app).post("/transferler"))
    .send({ birim_id: dokme.id, hedef_lokasyon_id: rafId, miktar: 50 })
    .expect(400);

  await auth(request(app).post("/stok-hareketleri"))
    .send({ birim_id: dokme.id, tip: "cikis", sebep: "fire", miktar: 40 })
    .expect(201);
});

test("rezerve palet butun olarak tasinabilir, rezervasyon paletle gider", async () => {
  const { birimler, siparisVer, auth, varyantId, kabulId, rafId } =
    await hazirla();

  await auth(request(app).post("/stok-birimleri/paletle"))
    .send({
      varyant_id: varyantId,
      lokasyon_id: kabulId,
      miktar: 50,
      kod: "P-TASI-TEST",
    })
    .expect(201);

  const palet = (await birimler()).find((b) => b.tip === "palet");

  await siparisVer(50, [{ birim_id: palet.id, miktar: 50 }]).expect(201);

  await auth(request(app).post("/transferler"))
    .send({ birim_id: palet.id, hedef_lokasyon_id: rafId })
    .expect(201);

  const tasinan = (await birimler()).find((b) => b.id === palet.id);
  assert.equal(tasinan.lokasyon_id, rafId, "palet rafa gitmis olmali");
  assert.equal(
    Number(tasinan.rezerve),
    50,
    "rezervasyon paletle birlikte gitmeli",
  );
});

test("sayim engellenmez, karsilanamayan rezervasyon saglik ekraninda gorunur", async () => {
  const { birimler, siparisVer, auth, kabulId } = await hazirla();
  const [dokme] = await birimler();

  const siparis = await siparisVer(60, [
    { birim_id: dokme.id, miktar: 60 },
  ]).expect(201);

  // sayim rezerve edilenin altina dusuruyor — engellenmemeli
  await auth(request(app).post("/sayim"))
    .send({
      lokasyon_id: kabulId,
      aciklama: "Rezervasyon testi",
      kalemler: [{ birim_id: dokme.id, sayilan_miktar: 40 }],
    })
    .expect(200);

  const [sayilan] = await birimler();
  assert.equal(Number(sayilan.miktar), 40);
  assert.equal(Number(sayilan.rezerve), 60);
  assert.equal(Number(sayilan.kullanilabilir), -20, "acik gorunur olmali");

  const saglik = await auth(request(app).get("/sistem/kontroller")).expect(200);
  const kontrol = saglik.body.kontroller.find(
    (k) => k.anahtar === "karsilanamayan_rezervasyon",
  );

  assert.equal(kontrol.satirlar.length, 1);
  assert.equal(Number(kontrol.satirlar[0].eksik), 20);

  // teslimat reddedilmeli
  const teslim = await auth(
    request(app).patch(`/satis-siparisleri/${siparis.body.id}/teslim-et`),
  ).expect(409);

  assert.match(teslim.body.hata, /ayrılan miktar yok/);

  // stok defteri yine tutarli
  const { variantTotal, unitTotal } = await stockTotals();
  assert.equal(unitTotal, variantTotal);
});
