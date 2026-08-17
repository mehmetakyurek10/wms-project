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

test("stok degismezi: butun akislar boyunca birim toplami = varyant toplami", async () => {
  await resetDatabase();
  const token = await getAdminToken(app);
  const { varyantId, kabulId, rafId, musteriId } = await seedWarehouse(
    app,
    token,
  );

  const auth = (istek) => istek.set("Authorization", `Bearer ${token}`);

  const birimleriGetir = async () => {
    const yanit = await auth(
      request(app).get(`/stok-birimleri?varyant_id=${varyantId}`),
    ).expect(200);
    return yanit.body;
  };

  const kontrol = async (adim, beklenen) => {
    const { variantTotal, unitTotal } = await stockTotals();

    assert.equal(
      unitTotal,
      variantTotal,
      `${adim}: SAPMA — varyant toplami ${variantTotal}, birim toplami ${unitTotal}`,
    );
    assert.equal(
      variantTotal,
      beklenen,
      `${adim}: beklenen ${beklenen}, bulunan ${variantTotal}`,
    );
  };

  await kontrol("baslangic", 0);

  // 1) Mal kabul: 100 adet dokme giris
  await auth(request(app).post("/stok-hareketleri"))
    .send({
      varyant_id: varyantId,
      lokasyon_id: kabulId,
      tip: "giris",
      sebep: "satinalma",
      miktar: 100,
    })
    .expect(201);

  await kontrol("giris", 100);

  // 2) 60 adedi paletle
  await auth(request(app).post("/stok-birimleri/paletle"))
    .send({
      varyant_id: varyantId,
      lokasyon_id: kabulId,
      miktar: 60,
      kod: "P-TEST-1",
    })
    .expect(201);

  await kontrol("paletleme", 100);

  // 3) Paleti rafa tasi
  let birimler = await birimleriGetir();
  const palet = birimler.find((b) => b.tip === "palet");

  await auth(request(app).post("/transferler"))
    .send({ birim_id: palet.id, hedef_lokasyon_id: rafId })
    .expect(201);

  await kontrol("palet transferi", 100);

  // 4) Dokmeden 10 adet fire cikisi
  birimler = await birimleriGetir();
  const dokme = birimler.find((b) => b.tip === "dokme");

  await auth(request(app).post("/stok-hareketleri"))
    .send({
      birim_id: dokme.id,
      tip: "cikis",
      sebep: "fire",
      miktar: 10,
    })
    .expect(201);

  await kontrol("fire cikisi", 90);

  // 5) Satis: 25 adet — 20 paletten, 5 dokmeden (tahsis siparis aninda yapilir)
  birimler = await birimleriGetir();
  const satisPalet = birimler.find((b) => b.tip === "palet");
  const satisDokme = birimler.find((b) => b.tip === "dokme");

  const siparis = await auth(request(app).post("/satis-siparisleri"))
    .send({
      musteri_id: musteriId,
      kalemler: [{ varyant_id: varyantId, miktar: 25, birim_fiyat: 100 }],
      tahsisler: [
        { birim_id: satisPalet.id, miktar: 20 },
        { birim_id: satisDokme.id, miktar: 5 },
      ],
    })
    .expect(201);

  // rezervasyon fiziksel stoga dokunmamali
  await kontrol("rezervasyon", 90);

  await auth(
    request(app).patch(`/satis-siparisleri/${siparis.body.id}/teslim-et`),
  ).expect(200);

  await kontrol("satis teslimati", 65);

  // 6) Sayim: mal kabuldeki dokme 25 gorunuyor, 20 sayildi
  birimler = await birimleriGetir();
  const sayilacak = birimler.find(
    (b) => b.tip === "dokme" && b.lokasyon_id === kabulId,
  );

  assert.equal(Number(sayilacak.miktar), 25, "sayim oncesi dokme 25 olmali");

  await auth(request(app).post("/sayim"))
    .send({
      lokasyon_id: kabulId,
      aciklama: "Test sayimi",
      kalemler: [{ birim_id: sayilacak.id, sayilan_miktar: 20 }],
    })
    .expect(200);

  await kontrol("sayim duzeltmesi", 60);
});

test("varyant baslangic stogu: birim ve hareket birlikte olusuyor", async () => {
  await resetDatabase();
  const token = await getAdminToken(app);
  const { kabulId } = await seedWarehouse(app, token);

  const auth = (istek) => istek.set("Authorization", `Bearer ${token}`);

  const varyantlar = await auth(request(app).get("/varyantlar")).expect(200);
  const urunId = varyantlar.body[0].urun_id;

  await auth(request(app).post("/varyantlar"))
    .send({
      urun_id: urunId,
      boy: "LOKASYONSUZ",
      ambalaj_tipi: "kova",
      ambalaj_kg: 10,
      miktar: 50,
    })
    .expect(400);

  const redSonrasi = await stockTotals();

  assert.equal(
    redSonrasi.variantTotal,
    0,
    "lokasyonsuz istek reddedildigi halde varyant miktari yazilmis",
  );

  const varyant = await auth(request(app).post("/varyantlar"))
    .send({
      urun_id: urunId,
      boy: "BASLANGIC",
      ambalaj_tipi: "kova",
      ambalaj_kg: 10,
      miktar: 50,
      lokasyon_id: kabulId,
    })
    .expect(201);

  const { variantTotal, unitTotal } = await stockTotals();

  assert.equal(variantTotal, 50, `varyant toplami 50 olmali, ${variantTotal}`);
  assert.equal(
    unitTotal,
    variantTotal,
    `SAPMA — varyant toplami ${variantTotal}, birim toplami ${unitTotal}`,
  );

  const birimler = await auth(
    request(app).get(`/stok-birimleri?varyant_id=${varyant.body.id}`),
  ).expect(200);

  assert.equal(birimler.body.length, 1, "stok birimi olusmamis");
  assert.equal(birimler.body[0].lokasyon_id, kabulId);
  assert.equal(Number(birimler.body[0].miktar), 50);

  const hareketler = await auth(
    request(app).get(`/stok-hareketleri?varyant_id=${varyant.body.id}`),
  ).expect(200);

  assert.equal(hareketler.body.length, 1, "deftere giris hareketi yazilmamis");
  assert.equal(hareketler.body[0].tip, "giris");
  assert.equal(Number(hareketler.body[0].miktar), 50);
});
