const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const { resetDatabase, getAdminToken, closePool } = require("./helpers");

const PERSONEL_EMAIL = "depocu@test.local";
const ESKI_SIFRE = "eski1234";
const YENI_SIFRE = "yeni5678";

after(async () => {
  await closePool();
});

async function personelOlustur(adminToken) {
  const yanit = await request(app)
    .post("/auth/kayit")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      ad: "Depo Personeli",
      email: PERSONEL_EMAIL,
      sifre: ESKI_SIFRE,
      rol: "depo_sorumlusu",
    })
    .expect(201);

  return yanit.body.id;
}

test("sifre sifirlaninca eski oturum duser, yeni sifre gecerli olur", async () => {
  await resetDatabase();
  const adminToken = await getAdminToken(app);
  const personelId = await personelOlustur(adminToken);

  const giris = await request(app)
    .post("/auth/giris")
    .send({ email: PERSONEL_EMAIL, sifre: ESKI_SIFRE })
    .expect(200);

  const eskiToken = giris.body.token;

  await request(app)
    .get("/varyantlar")
    .set("Authorization", `Bearer ${eskiToken}`)
    .expect(200);

  await request(app)
    .post(`/kullanicilar/${personelId}/sifre-sifirla`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ yeniSifre: YENI_SIFRE })
    .expect(200);

  await request(app)
    .get("/varyantlar")
    .set("Authorization", `Bearer ${eskiToken}`)
    .expect(401);

  await request(app)
    .post("/auth/giris")
    .send({ email: PERSONEL_EMAIL, sifre: ESKI_SIFRE })
    .expect(401);

  const yeniGiris = await request(app)
    .post("/auth/giris")
    .send({ email: PERSONEL_EMAIL, sifre: YENI_SIFRE })
    .expect(200);

  assert.ok(yeniGiris.body.token, "yeni sifreyle giriste access token donmeli");
});

test("sifre sifirlama sinirlari", async () => {
  await resetDatabase();
  const adminToken = await getAdminToken(app);
  const personelId = await personelOlustur(adminToken);

  const auth = (istek) => istek.set("Authorization", `Bearer ${adminToken}`);

  const [kendiKaydi] = (
    await auth(request(app).get("/kullanicilar")).expect(200)
  ).body.filter((k) => k.rol === "admin");

  await auth(request(app).post(`/kullanicilar/${kendiKaydi.id}/sifre-sifirla`))
    .send({ yeniSifre: YENI_SIFRE })
    .expect(400);

  await auth(request(app).post(`/kullanicilar/${personelId}/sifre-sifirla`))
    .send({ yeniSifre: "kisa" })
    .expect(400);

  await auth(request(app).post("/kullanicilar/999999/sifre-sifirla"))
    .send({ yeniSifre: YENI_SIFRE })
    .expect(404);

  await request(app)
    .post(`/kullanicilar/${personelId}/sifre-sifirla`)
    .send({ yeniSifre: YENI_SIFRE })
    .expect(401);
});
