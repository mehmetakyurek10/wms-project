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

  await auth(request(app).post("/stok-hareketleri"))
    .send({
      varyant_id: seed.varyantId,
      lokasyon_id: seed.kabulId,
      tip: "giris",
      sebep: "satinalma",
      miktar: 200,
    })
    .expect(201);

  const birimler = async () => {
    const yanit = await auth(
      request(app).get(`/stok-birimleri?varyant_id=${seed.varyantId}`),
    ).expect(200);
    return yanit.body;
  };

  const paletle = (lokasyonId, miktar, kod) =>
    auth(request(app).post("/stok-birimleri/paletle")).send({
      varyant_id: seed.varyantId,
      lokasyon_id: lokasyonId,
      miktar,
      kod,
    });

  const tasi = (birimId, hedefId, miktar) =>
    auth(request(app).post("/transferler")).send(
      miktar === undefined
        ? { birim_id: birimId, hedef_lokasyon_id: hedefId }
        : { birim_id: birimId, hedef_lokasyon_id: hedefId, miktar },
    );

  return { ...seed, auth, birimler, paletle, tasi };
}

test("palet gozune ikinci palet transfer edilemez", async () => {
  const { kabulId, rafId, birimler, paletle, tasi } = await hazirla();

  await paletle(kabulId, 30, "P-GOZ-1").expect(201);
  await paletle(kabulId, 30, "P-GOZ-2").expect(201);

  const paletler = (await birimler()).filter((b) => b.tip === "palet");

  assert.equal(
    paletler.length,
    2,
    "alan tipi lokasyon birden fazla palet alabilmeli",
  );

  await tasi(paletler[0].id, rafId).expect(201);

  const ikinci = await tasi(paletler[1].id, rafId).expect(409);
  assert.match(ikinci.body.hata, /palet gözünde zaten bir palet var/i);

  const rafta = (await birimler()).filter(
    (b) => b.tip === "palet" && b.lokasyon_id === rafId,
  );

  assert.equal(rafta.length, 1, "palet gozunde tek palet kalmali");
});

test("dolu palet gozunde yeni palet olusturulamaz", async () => {
  const { kabulId, rafId, birimler, paletle, tasi } = await hazirla();

  await paletle(kabulId, 30, "P-OLUS-1").expect(201);

  const [palet] = (await birimler()).filter((b) => b.tip === "palet");
  await tasi(palet.id, rafId).expect(201);

  const dokme = (await birimler()).find((b) => b.tip === "dokme");
  await tasi(dokme.id, rafId, 40).expect(201);

  const sonuc = await paletle(rafId, 20, "P-OLUS-2").expect(409);
  assert.match(sonuc.body.hata, /palet gözünde zaten bir palet var/i);
});
