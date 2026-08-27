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

test("ayni adla ikinci kategori sunucu hatasi yerine 409 doner", async () => {
  const { auth } = await hazirla();

  const yanit = await auth(request(app).post("/kategoriler"))
    .send({ ad: "Test Kategori" })
    .expect(409);

  assert.match(yanit.body.hata, /zaten var/i);
});

test("siparisi olan tedarikci silinemez", async () => {
  const { auth, tedarikciId, varyantId } = await hazirla();

  await auth(request(app).post("/satinalma-siparisleri"))
    .send({
      tedarikci_id: tedarikciId,
      kalemler: [{ varyant_id: varyantId, miktar: 10, birim_fiyat: 50 }],
    })
    .expect(201);

  const yanit = await auth(
    request(app).delete(`/tedarikciler/${tedarikciId}`),
  ).expect(409);

  assert.match(yanit.body.hata, /siparişi var/i);
});

test("siparisi olmayan tedarikci silinebilir", async () => {
  const { auth } = await hazirla();

  const yeni = await auth(request(app).post("/tedarikciler"))
    .send({ ad: "Silinecek Tedarikci" })
    .expect(201);

  await auth(request(app).delete(`/tedarikciler/${yeni.body.id}`)).expect(200);
});
