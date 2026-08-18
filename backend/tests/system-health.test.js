const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const {
  resetDatabase,
  getAdminToken,
  seedWarehouse,
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

  const kontrolAl = async (anahtar) => {
    const yanit = await auth(request(app).get("/sistem/kontroller")).expect(
      200,
    );
    return yanit.body.kontroller.find((k) => k.anahtar === anahtar);
  };

  const girisYap = (lokasyonId, miktar) =>
    auth(request(app).post("/stok-hareketleri")).send({
      varyant_id: seed.varyantId,
      lokasyon_id: lokasyonId,
      tip: "giris",
      sebep: "satinalma",
      miktar,
    });

  const paletle = (lokasyonId, miktar, kod) =>
    auth(request(app).post("/stok-birimleri/paletle")).send({
      varyant_id: seed.varyantId,
      lokasyon_id: lokasyonId,
      miktar,
      kod,
    });

  return { ...seed, auth, kontrolAl, girisYap, paletle };
}

test("saglikli sistemde hicbir kontrol uyari uretmez", async () => {
  const { auth, girisYap, kabulId } = await hazirla();

  await girisYap(kabulId, 100).expect(201);

  const yanit = await auth(request(app).get("/sistem/kontroller")).expect(200);

  assert.equal(yanit.body.kontroller.length, 6, "kontrol sayisi degismis");

  for (const kontrol of yanit.body.kontroller) {
    assert.equal(
      kontrol.satirlar.length,
      0,
      `${kontrol.anahtar} normal isleyiste yanlis uyari veriyor`,
    );
  }
});

test("pasif lokasyonda kalan stok uyari verir", async () => {
  const { auth, girisYap, kontrolAl, kabulId } = await hazirla();

  await girisYap(kabulId, 50).expect(201);

  const once = await kontrolAl("pasif_lokasyonda_stok");
  assert.equal(once.satirlar.length, 0);

  await auth(request(app).put(`/lokasyonlar/${kabulId}`))
    .send({
      kod: "TEST-KABUL",
      tip: "alan",
      satir: 1,
      kolon: 1,
      kapasite: 0,
      aktif: false,
    })
    .expect(200);

  const sonra = await kontrolAl("pasif_lokasyonda_stok");

  assert.equal(
    sonra.satirlar.length,
    1,
    "pasife alinan lokasyonda kalan stok gorunmuyor",
  );
  assert.equal(Number(sonra.satirlar[0].miktar), 50);
});

test("kapasite asimi: tanimsiz kapasite sayilmaz, sinir asilinca uyari cikar", async () => {
  const { auth, girisYap, paletle, kontrolAl, kabulId } = await hazirla();

  await girisYap(kabulId, 100).expect(201);
  await paletle(kabulId, 30, "P-KABUL-1").expect(201);
  await paletle(kabulId, 30, "P-KABUL-2").expect(201);

  const tanimsiz = await kontrolAl("kapasite_asimi");
  assert.equal(
    tanimsiz.satirlar.length,
    0,
    "kapasitesi 0 olan alan kapasite asimina girmemeli",
  );

  const darRaf = await auth(request(app).post("/lokasyonlar"))
    .send({ kod: "TEST-DAR", tip: "palet", satir: 3, kolon: 1, kapasite: 1 })
    .expect(201);

  await girisYap(darRaf.body.id, 60).expect(201);
  await paletle(darRaf.body.id, 30, "P-DAR-1").expect(201);

  const sinirda = await kontrolAl("kapasite_asimi");
  assert.equal(
    sinirda.satirlar.length,
    0,
    "kapasite tam dolu, asilmis degil - uyari cikmamali",
  );

  await paletle(darRaf.body.id, 30, "P-DAR-2").expect(201);

  const asim = await kontrolAl("kapasite_asimi");

  assert.equal(asim.satirlar.length, 1, "kapasite asimi yakalanmadi");
  assert.equal(asim.satirlar[0].lokasyon_kodu, "TEST-DAR");
  assert.equal(Number(asim.satirlar[0].palet_sayisi), 2);
  assert.equal(Number(asim.satirlar[0].asim), 1);
});
