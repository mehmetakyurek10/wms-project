const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const { buildPagination, MAKS_LIMIT } = require("../utils/pagination");
const { resetDatabase, getAdminToken, closePool } = require("./helpers");

after(async () => {
  await closePool();
});

test("buildPagination: istemci ust siniri asamaz", () => {
  assert.equal(
    buildPagination({ limit: "999999" }).limit,
    MAKS_LIMIT,
    "sinirsiz sorgu kapisi acik",
  );
  assert.equal(buildPagination({ limit: "0" }).limit, MAKS_LIMIT);
  assert.equal(buildPagination({ limit: "-5" }).limit, MAKS_LIMIT);
  assert.equal(buildPagination({ limit: "abc" }).limit, MAKS_LIMIT);
});

test("buildPagination: sayfa ve offset hesabi", () => {
  assert.equal(buildPagination({}).sayfa, 1);
  assert.equal(buildPagination({ sayfa: "0" }).sayfa, 1);
  assert.equal(buildPagination({ sayfa: "-3" }).sayfa, 1);
  assert.equal(buildPagination({ sayfa: "3", limit: "20" }).offset, 40);
  assert.equal(buildPagination({ sayfa: "1", limit: "20" }).offset, 0);
});

test("buildPagination: varsayilan limit cagiran tarafindan belirlenir", () => {
  assert.equal(buildPagination({}, 20).limit, 20);
  assert.equal(buildPagination({ limit: "50" }, 20).limit, 50);
  assert.equal(buildPagination({}).limit, MAKS_LIMIT);
});

test("sayfalama sozlesmesi: toplam basligi ve dilimleme", async () => {
  await resetDatabase();
  const token = await getAdminToken(app);
  const auth = (istek) => istek.set("Authorization", `Bearer ${token}`);

  for (let i = 1; i <= 25; i += 1) {
    await auth(request(app).post("/musteriler"))
      .send({ ad: `Musteri ${String(i).padStart(2, "0")}` })
      .expect(201);
  }

  const ilk = await auth(
    request(app).get("/musteriler?sayfa=1&limit=20"),
  ).expect(200);

  assert.equal(ilk.body.length, 20);
  assert.equal(
    ilk.headers["x-toplam-kayit"],
    "25",
    "toplam kayit basligi sayfadaki kadar degil, tumunu bildirmeli",
  );

  const ikinci = await auth(
    request(app).get("/musteriler?sayfa=2&limit=20"),
  ).expect(200);

  assert.equal(ikinci.body.length, 5);
  assert.equal(ikinci.headers["x-toplam-kayit"], "25");

  const ilkIdler = ilk.body.map((m) => m.id);
  const ikinciIdler = ikinci.body.map((m) => m.id);
  const tekrar = ilkIdler.filter((id) => ikinciIdler.includes(id));

  assert.equal(tekrar.length, 0, "sayfalar arasinda tekrar eden kayit var");
  assert.equal(
    new Set([...ilkIdler, ...ikinciIdler]).size,
    25,
    "iki sayfa birlikte tum kayitlari kapsamiyor",
  );
});
