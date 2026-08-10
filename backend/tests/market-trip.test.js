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

// Her test kendi veritabanini kuruyor ve tek giris yapiyor; giris ucundaki
// 15 dakika / 10 deneme sinirina dikkat ederek test ekle.
async function hazirla() {
  await resetDatabase();
  const token = await getAdminToken(app);
  const seed = await seedWarehouse(app, token);
  const auth = (istek) => istek.set("Authorization", `Bearer ${token}`);

  // seedWarehouse'daki TEST-KABUL "alan" tipinde; sefer kapanisi ise
  // tip = 'kabul' olan bir lokasyon ariyor. Ayrica pazar lokasyonu gerekiyor.
  const pazar = await auth(request(app).post("/lokasyonlar"))
    .send({
      kod: "TEST-PAZAR",
      ad: "Sali pazari",
      tip: "pazar",
      satir: 1,
      kolon: 3,
      kapasite: 0,
    })
    .expect(201);

  const malKabul = await auth(request(app).post("/lokasyonlar"))
    .send({
      kod: "TEST-MALKABUL",
      tip: "kabul",
      satir: 1,
      kolon: 4,
      kapasite: 0,
    })
    .expect(201);

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

  const depoBirimi = (await birimler()).find(
    (b) => b.tip === "dokme" && b.lokasyon_id === seed.kabulId,
  );

  // Bilerek senkron: supertest'in zincirlenebilir istek nesnesini dondurmesi
  // gerekiyor, async yapilirsa Promise doner ve .expect() cagrilamaz.
  const seferAc = (miktar) =>
    auth(request(app).post("/pazar-seferleri")).send({
      lokasyon_id: pazar.body.id,
      kalemler: [{ varyant_id: seed.varyantId, miktar }],
      tahsisler: [{ birim_id: depoBirimi.id, miktar }],
    });

  return {
    ...seed,
    auth,
    birimler,
    seferAc,
    depoBirimi,
    pazarId: pazar.body.id,
    malKabulId: malKabul.body.id,
  };
}

test("sefer acilinca mal pazara tasinir, toplam stok degismez", async () => {
  const { seferAc, birimler, pazarId, kabulId } = await hazirla();

  const yanit = await seferAc(100).expect(201);
  assert.match(yanit.body.fis_no, /^P-\d{4}-\d{4}$/);

  const liste = await birimler();
  const pazardaki = liste.find((b) => b.lokasyon_id === pazarId);
  const depodaki = liste.find((b) => b.lokasyon_id === kabulId);

  assert.ok(pazardaki, "pazarda dokme birim olusmali");
  assert.equal(Number(pazardaki.miktar), 100);
  assert.ok(!depodaki, "depodaki birim bosaldigi icin silinmeli");

  const { variantTotal, unitTotal } = await stockTotals();
  assert.equal(unitTotal, variantTotal);
  assert.equal(variantTotal, 100, "tasima toplam stogu degistirmemeli");
});

test("acik sefer varken yeni sefer acilamaz", async () => {
  const { seferAc } = await hazirla();

  await seferAc(60).expect(201);

  const ikinci = await seferAc(20).expect(409);
  assert.match(ikinci.body.hata, /yolda/i);
});

test("rezerve stok pazara cikamaz", async () => {
  const { auth, seferAc, depoBirimi, musteriId, varyantId } = await hazirla();

  await auth(request(app).post("/satis-siparisleri"))
    .send({
      musteri_id: musteriId,
      kalemler: [{ varyant_id: varyantId, miktar: 80, birim_fiyat: 100 }],
      tahsisler: [{ birim_id: depoBirimi.id, miktar: 80 }],
    })
    .expect(201);

  const yanit = await seferAc(100).expect(400);
  assert.match(yanit.body.hata, /kullanılabilir/i);
});

test("sefer kapaninca donen mal kabule girer, satilan stoktan duser", async () => {
  const { auth, seferAc, birimler, pazarId, malKabulId, varyantId } =
    await hazirla();

  const acilis = await seferAc(100).expect(201);

  await auth(request(app).patch(`/pazar-seferleri/${acilis.body.id}/kapat`))
    .send({ kalemler: [{ varyant_id: varyantId, donen_miktar: 26 }] })
    .expect(200);

  const liste = await birimler();
  const pazardaki = liste.find((b) => b.lokasyon_id === pazarId);
  const kabuldeki = liste.find((b) => b.lokasyon_id === malKabulId);

  assert.ok(!pazardaki, "sefer kapaninca pazar lokasyonu bosalmali");
  assert.ok(kabuldeki, "donen mal kabule girmeli");
  assert.equal(Number(kabuldeki.miktar), 26);

  const { variantTotal, unitTotal } = await stockTotals();
  assert.equal(unitTotal, variantTotal);
  assert.equal(variantTotal, 26, "satilan 74 adet stoktan dusmeli");

  const kalemler = await auth(
    request(app).get(`/pazar-seferleri/${acilis.body.id}/kalemler`),
  ).expect(200);

  assert.equal(Number(kalemler.body[0].giden_miktar), 100);
  assert.equal(Number(kalemler.body[0].donen_miktar), 26);
});

test("hicbir sey donmezse tum mal satilmis sayilir", async () => {
  const { auth, seferAc, birimler, varyantId } = await hazirla();

  const acilis = await seferAc(100).expect(201);

  await auth(request(app).patch(`/pazar-seferleri/${acilis.body.id}/kapat`))
    .send({ kalemler: [{ varyant_id: varyantId, donen_miktar: 0 }] })
    .expect(200);

  assert.equal((await birimler()).length, 0, "hicbir yerde stok kalmamali");

  const { variantTotal, unitTotal } = await stockTotals();
  assert.equal(unitTotal, variantTotal);
  assert.equal(variantTotal, 0);
});

test("donen miktar gidenden fazla olamaz", async () => {
  const { auth, seferAc, varyantId } = await hazirla();

  const acilis = await seferAc(100).expect(201);

  const yanit = await auth(
    request(app).patch(`/pazar-seferleri/${acilis.body.id}/kapat`),
  )
    .send({ kalemler: [{ varyant_id: varyantId, donen_miktar: 120 }] })
    .expect(400);

  assert.match(yanit.body.hata, /fazla olamaz/i);
});

test("kapatilmis sefer tekrar kapatilamaz", async () => {
  const { auth, seferAc, varyantId } = await hazirla();

  const acilis = await seferAc(100).expect(201);
  const kapat = () =>
    auth(request(app).patch(`/pazar-seferleri/${acilis.body.id}/kapat`)).send({
      kalemler: [{ varyant_id: varyantId, donen_miktar: 10 }],
    });

  await kapat().expect(200);

  const ikinci = await kapat().expect(400);
  assert.match(ikinci.body.hata, /zaten kapat/i);
});
