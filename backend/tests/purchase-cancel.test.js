const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const { resetDatabase, seedWarehouse, closePool } = require("./helpers");

let adminToken;
let depoToken;
let seed;

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

async function siparisAc() {
  const yanit = await yonetici(request(app).post("/satinalma-siparisleri"))
    .send({
      tedarikci_id: seed.tedarikciId,
      kalemler: [{ varyant_id: seed.varyantId, miktar: 100, birim_fiyat: 50 }],
    })
    .expect(201);

  return yanit.body.id;
}

test("iptal edilen siparis bekleyen sayacindan duser ve sebebi kayitli kalir", async () => {
  const id = await siparisAc();

  const oncesi = await yonetici(
    request(app).get("/satinalma-siparisleri?bekleyen=1"),
  ).expect(200);

  await yonetici(request(app).patch(`/satinalma-siparisleri/${id}/iptal`))
    .send({ aciklama: "Tedarikci malin olmadigini bildirdi" })
    .expect(200);

  const sonrasi = await yonetici(
    request(app).get("/satinalma-siparisleri?bekleyen=1"),
  ).expect(200);

  assert.equal(
    Number(sonrasi.headers["x-toplam-kayit"]),
    Number(oncesi.headers["x-toplam-kayit"]) - 1,
    "iptal edilen siparis bekleyen sayacini kirletmemeli",
  );

  const hepsi = await yonetici(
    request(app).get("/satinalma-siparisleri"),
  ).expect(200);

  const iptalEdilen = hepsi.body.find((s) => s.id === id);

  assert.equal(iptalEdilen.durum, "iptal");
  assert.equal(
    iptalEdilen.iptal_aciklamasi,
    "Tedarikci malin olmadigini bildirdi",
  );
  assert.ok(iptalEdilen.iptal_tarihi, "iptal tarihi yazilmali");
});

test("iptal stok tarafina dokunmaz", async () => {
  const id = await siparisAc();

  await yonetici(request(app).patch(`/satinalma-siparisleri/${id}/iptal`))
    .send({ aciklama: "Yanlis tedarikciye acilmis" })
    .expect(200);

  const hareketler = await yonetici(
    request(app).get("/stok-hareketleri"),
  ).expect(200);

  const iptalHareketi = hareketler.body.find((h) =>
    String(h.aciklama || "").includes(`#${id}`),
  );

  assert.equal(
    iptalHareketi,
    undefined,
    "teslim alinmamis siparisin iptali hareket uretmemeli",
  );
});

test("iptal edilmis siparis tekrar iptal edilemez", async () => {
  const id = await siparisAc();

  await yonetici(request(app).patch(`/satinalma-siparisleri/${id}/iptal`))
    .send({ aciklama: "Yanlis acildi" })
    .expect(200);

  const ikinci = await yonetici(
    request(app).patch(`/satinalma-siparisleri/${id}/iptal`),
  )
    .send({ aciklama: "Yanlis acildi" })
    .expect(400);

  assert.match(ikinci.body.hata, /zaten iptal/i);
});

test("iptal edilmis siparis teslim alinamaz", async () => {
  const id = await siparisAc();

  await yonetici(request(app).patch(`/satinalma-siparisleri/${id}/iptal`))
    .send({ aciklama: "Siparis fazladan girilmis" })
    .expect(200);

  const yanit = await yonetici(
    request(app).patch(`/satinalma-siparisleri/${id}/teslim-al`),
  )
    .send({ lokasyon_id: seed.kabulId })
    .expect(400);

  assert.match(yanit.body.hata, /[İi]ptal edilmiş/);
});

test("teslim alinmis siparis iptal edilemez", async () => {
  const id = await siparisAc();

  await yonetici(request(app).patch(`/satinalma-siparisleri/${id}/teslim-al`))
    .send({ lokasyon_id: seed.kabulId })
    .expect(200);

  const yanit = await yonetici(
    request(app).patch(`/satinalma-siparisleri/${id}/iptal`),
  )
    .send({ aciklama: "Vazgectik" })
    .expect(400);

  assert.match(yanit.body.hata, /teslim alınmış/i);
});

test("depo sorumlusu da siparis iptal edebilir", async () => {
  const id = await siparisAc();

  await depocu(request(app).patch(`/satinalma-siparisleri/${id}/iptal`))
    .send({ aciklama: "Musteri vazgecti" })
    .expect(200);

  const hepsi = await yonetici(
    request(app).get("/satinalma-siparisleri"),
  ).expect(200);

  assert.equal(hepsi.body.find((s) => s.id === id).durum, "iptal");
});

test("iptal sebebi zorunlu", async () => {
  const id = await siparisAc();

  await yonetici(request(app).patch(`/satinalma-siparisleri/${id}/iptal`))
    .send({})
    .expect(400);

  await yonetici(request(app).patch(`/satinalma-siparisleri/${id}/iptal`))
    .send({ aciklama: "  " })
    .expect(400);
});

test("olmayan siparisin iptali 404 doner", async () => {
  await yonetici(request(app).patch("/satinalma-siparisleri/999999/iptal"))
    .send({ aciklama: "Deneme" })
    .expect(404);
});
