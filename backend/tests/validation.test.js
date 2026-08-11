const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const { resetDatabase, seedWarehouse, closePool } = require("./helpers");

let token;
let seed;

const auth = (istek) => istek.set("Authorization", `Bearer ${token}`);

// Bu dosyada tek bir giris yapiliyor; giris ucunda 15 dakikada 10 deneme
// siniri var ve sayac bellekte tutuluyor.
before(async () => {
  await resetDatabase();

  await request(app)
    .post("/auth/kayit")
    .send({ ad: "Test Admin", email: "admin@test.local", sifre: "test1234" })
    .expect(201);

  const giris = await request(app)
    .post("/auth/giris")
    .send({ email: "admin@test.local", sifre: "test1234" })
    .expect(200);

  token = giris.body.token;
  seed = await seedWarehouse(app, token);
});

after(async () => {
  await closePool();
});

// Kontrollu React formlari doldurulmamis alanlari bos metin olarak
// gonderiyor. Denetleyiciler bunu her zaman "gonderilmemis" saydi; sema
// katmani da ayni davranisi surdurmek zorunda. z.coerce.number bos metni
// 0'a cevirdigi icin bu koruma olmadan calisan ekranlar 400 alir.
test("giris hareketinde bos birim_id gonderilmemis sayilir", async () => {
  await auth(request(app).post("/stok-hareketleri"))
    .send({
      varyant_id: seed.varyantId,
      lokasyon_id: seed.kabulId,
      birim_id: "",
      tip: "giris",
      sebep: "satinalma",
      miktar: 50,
      aciklama: "",
    })
    .expect(201);
});

test("cikis hareketinde bos lokasyon_id gonderilmemis sayilir", async () => {
  const birimler = await auth(
    request(app).get(`/stok-birimleri?varyant_id=${seed.varyantId}`),
  ).expect(200);

  const dokme = birimler.body.find((b) => b.tip === "dokme");
  assert.ok(dokme, "onceki testten dokme birim kalmali");

  await auth(request(app).post("/stok-hareketleri"))
    .send({
      varyant_id: seed.varyantId,
      lokasyon_id: "",
      birim_id: dokme.id,
      tip: "cikis",
      sebep: "fire",
      miktar: 5,
      aciklama: "",
    })
    .expect(201);
});

test("hata mesajlari degismedi", async () => {
  const durumlar = [
    [
      {
        varyant_id: seed.varyantId,
        lokasyon_id: seed.kabulId,
        tip: "giris",
        miktar: 0,
      },
      "Miktar sıfırdan büyük olmalıdır",
    ],
    [
      {
        varyant_id: seed.varyantId,
        lokasyon_id: seed.kabulId,
        tip: "sacma",
        miktar: 5,
      },
      "Hareket tipi giris veya cikis olmalı",
    ],
    [
      {
        varyant_id: seed.varyantId,
        lokasyon_id: seed.kabulId,
        tip: "giris",
        sebep: "uydurma",
        miktar: 5,
      },
      "Geçersiz sebep",
    ],
    [
      {
        varyant_id: "",
        lokasyon_id: "",
        birim_id: "",
        tip: "giris",
        miktar: 5,
      },
      "Varyant ve lokasyon seçilmelidir",
    ],
    [
      {
        varyant_id: "",
        lokasyon_id: "",
        birim_id: "",
        tip: "cikis",
        miktar: 5,
      },
      "Çıkış yapılacak stok birimi seçilmelidir",
    ],
  ];

  for (const [govde, beklenen] of durumlar) {
    const yanit = await auth(request(app).post("/stok-hareketleri"))
      .send(govde)
      .expect(400);

    assert.equal(yanit.body.hata, beklenen);
  }
});

test("satis siparisi mesajlari degismedi", async () => {
  const durumlar = [
    [{}, "Müşteri seçilmelidir"],
    [{ musteri_id: seed.musteriId }, "En az bir kalem eklemelisiniz"],
    [
      { musteri_id: seed.musteriId, kalemler: [] },
      "En az bir kalem eklemelisiniz",
    ],
    [
      {
        musteri_id: seed.musteriId,
        kalemler: [{ varyant_id: seed.varyantId, miktar: 1, birim_fiyat: 10 }],
      },
      "Stok hangi birimlerden ayrılacak, seçilmelidir",
    ],
    [
      {
        musteri_id: seed.musteriId,
        kalemler: [{ varyant_id: seed.varyantId, miktar: -1, birim_fiyat: 10 }],
        tahsisler: [{ birim_id: 1, miktar: 1 }],
      },
      "Miktar sıfırdan büyük olmalıdır",
    ],
    [
      {
        musteri_id: seed.musteriId,
        kalemler: [{ varyant_id: seed.varyantId, miktar: 1, birim_fiyat: -5 }],
        tahsisler: [{ birim_id: 1, miktar: 1 }],
      },
      "Birim fiyat geçersiz",
    ],
  ];

  for (const [govde, beklenen] of durumlar) {
    const yanit = await auth(request(app).post("/satis-siparisleri"))
      .send(govde)
      .expect(400);

    assert.equal(yanit.body.hata, beklenen);
  }
});

// Arayuz kalemlere sunucunun kullanmadigi alanlar ekliyor (birim, urun_adi
// gibi). Sema bunlari sessizce dusurmeli; reddederse siparis ekrani kirilir.
test("semada olmayan alanlar istegi reddettirmez", async () => {
  const birimler = await auth(
    request(app).get(`/stok-birimleri?varyant_id=${seed.varyantId}`),
  ).expect(200);

  const dokme = birimler.body.find((b) => Number(b.kullanilabilir) > 0);
  assert.ok(dokme, "kullanilabilir stok olmali");

  await auth(request(app).post("/satis-siparisleri"))
    .send({
      musteri_id: seed.musteriId,
      kalemler: [
        {
          varyant_id: seed.varyantId,
          miktar: 10,
          birim_fiyat: 100,
          birim: "adet",
          urun_adi: "Sunucunun kullanmadigi alan",
        },
      ],
      tahsisler: [{ birim_id: dokme.id, miktar: 10 }],
    })
    .expect(201);
});

// aciklama kolonlari VARCHAR(255). Once MySQL hatasi 500 olarak donuyordu.
test("aciklama 255 karakteri asarsa anlamli 400 doner", async () => {
  const yanit = await auth(request(app).post("/stok-hareketleri"))
    .send({
      varyant_id: seed.varyantId,
      lokasyon_id: seed.kabulId,
      tip: "giris",
      sebep: "manuel",
      miktar: 1,
      aciklama: "a".repeat(256),
    })
    .expect(400);

  assert.match(yanit.body.hata, /255/);
});

test("sayim kalemi ne birim ne varyant tasiyorsa reddedilir", async () => {
  const yanit = await auth(request(app).post("/sayim"))
    .send({
      lokasyon_id: seed.kabulId,
      kalemler: [{ sayilan_miktar: 5 }],
    })
    .expect(400);

  assert.equal(yanit.body.hata, "Geçersiz kalem");
});

test("transferde hedef lokasyon zorunlu, miktar degil", async () => {
  const yanit = await auth(request(app).post("/transferler"))
    .send({ birim_id: 1, hedef_lokasyon_id: "" })
    .expect(400);

  assert.equal(yanit.body.hata, "Taşınacak birim ve hedef lokasyon zorunludur");
});

test("satis fiyati kayitli fiyattan cok saparsa reddedilir", async () => {
  const birimler = await auth(
    request(app).get(`/stok-birimleri?varyant_id=${seed.varyantId}`),
  ).expect(200);

  const dokme = birimler.body.find((b) => Number(b.kullanilabilir) > 0);
  assert.ok(dokme, "kullanilabilir stok olmali");

  // seedWarehouse varyanti 100 birim toptan fiyatla olusturuyor.
  // 10 degeri %90 sapma demek, esigin disinda.
  const sapan = await auth(request(app).post("/satis-siparisleri"))
    .send({
      musteri_id: seed.musteriId,
      kalemler: [{ varyant_id: seed.varyantId, miktar: 1, birim_fiyat: 10 }],
      tahsisler: [{ birim_id: dokme.id, miktar: 1 }],
    })
    .expect(400);

  assert.match(sapan.body.hata, /çok farklı/i);

  // 110 ise %10 sapma; pazarlik payi icinde kalir ve kabul edilir.
  await auth(request(app).post("/satis-siparisleri"))
    .send({
      musteri_id: seed.musteriId,
      kalemler: [{ varyant_id: seed.varyantId, miktar: 1, birim_fiyat: 110 }],
      tahsisler: [{ birim_id: dokme.id, miktar: 1 }],
    })
    .expect(201);
});
