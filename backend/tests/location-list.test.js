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

  return { ...seed, auth };
}

async function stokGir(auth, varyantId, lokasyonId, miktar) {
  await auth(request(app).post("/stok-hareketleri"))
    .send({
      varyant_id: varyantId,
      lokasyon_id: lokasyonId,
      tip: "giris",
      sebep: "satinalma",
      miktar,
    })
    .expect(201);
}

test("sayfalama istenmezse tum lokasyonlar doner", async () => {
  const { auth } = await hazirla();

  const yanit = await auth(request(app).get("/lokasyonlar")).expect(200);

  assert.equal(
    yanit.body.length,
    2,
    "seciciler tam listeye ihtiyac duyar, sessizce kirpilmamali",
  );
  assert.equal(yanit.headers["x-toplam-kayit"], "2");
});

test("sayfalama istendiginde uygulanir", async () => {
  const { auth } = await hazirla();

  const ilk = await auth(
    request(app).get("/lokasyonlar?sayfa=1&limit=1"),
  ).expect(200);

  assert.equal(ilk.body.length, 1);
  assert.equal(ilk.headers["x-toplam-kayit"], "2");

  const ikinci = await auth(
    request(app).get("/lokasyonlar?sayfa=2&limit=1"),
  ).expect(200);

  assert.equal(ikinci.body.length, 1);
  assert.notEqual(
    ikinci.body[0].id,
    ilk.body[0].id,
    "ikinci sayfa farkli kayit dondurmeli",
  );
});

test("dolu bayragi stok durumunu yansitir", async () => {
  const { auth, kabulId, varyantId } = await hazirla();

  const bos = await auth(request(app).get("/lokasyonlar")).expect(200);

  assert.equal(
    bos.body.every((l) => Number(l.dolu) === 0),
    true,
    "stok girilmeden hicbir goz dolu gorunmemeli",
  );

  await stokGir(auth, varyantId, kabulId, 50);

  const sonra = await auth(request(app).get("/lokasyonlar")).expect(200);
  const kabul = sonra.body.find((l) => l.id === kabulId);
  const raf = sonra.body.find((l) => l.id !== kabulId);

  assert.equal(Number(kabul.dolu), 1);
  assert.equal(Number(raf.dolu), 0);
});

test("liste ucu stok toplami tasimaz", async () => {
  const { auth, kabulId, varyantId } = await hazirla();

  await stokGir(auth, varyantId, kabulId, 50);

  const yanit = await auth(request(app).get("/lokasyonlar")).expect(200);

  assert.equal(
    yanit.body[0].toplam_miktar,
    undefined,
    "hafif uc agir kolonlari tasimamali",
  );
  assert.equal(yanit.body[0].kalem_sayisi, undefined);
});

test("harita ucu stok toplamini ve kalem sayisini doner", async () => {
  const { auth, kabulId, varyantId } = await hazirla();

  await stokGir(auth, varyantId, kabulId, 50);

  const yanit = await auth(request(app).get("/lokasyonlar/harita")).expect(200);
  const kabul = yanit.body.find((l) => l.id === kabulId);

  assert.equal(Number(kabul.toplam_miktar), 50);
  assert.equal(Number(kabul.kalem_sayisi), 1);
  assert.ok(
    "satir_span" in kabul,
    "harita ucu yerlesim kolonlarini da tasimali",
  );
});
