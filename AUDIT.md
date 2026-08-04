# WMS Projesi — Teknik Denetim Raporu

**Tarih:** 2026-07-31
**Kapsam:** `backend/` (Express 5 + MySQL2) ve `frontend/` (React 19 + Vite 8), commit `a7241d6` üzerindeki çalışma ağacı
**Yöntem:** Statik kod incelemesi (tüm controller / route / middleware dosyaları satır satır okundu), `npm audit`, git geçmişi taraması. Uygulama **çalıştırılmadı**, veritabanına bağlanılmadı.

> **Önemli kısıt:** Repoda hiçbir şema (DDL), migration veya seed dosyası yok. Tablo tanımları, yabancı anahtarlar, `UNIQUE` kısıtları, `CHECK` kısıtları ve indeksler **doğrulanamadı**. Aşağıda şemaya dair her çıkarım yalnızca uygulama kodundaki ipuçlarına (`ER_DUP_ENTRY` yakalamaları, `ON DUPLICATE KEY UPDATE` kullanımı, kolon adları) dayanmaktadır ve "Doğrulanamayanlar" bölümünde ayrıca listelenmiştir.
>
> **Not:** Bu kısıt artık geçerli değil. `backend/db/schema.sql` repoya alındı ve güncel tutuluyor (bkz. Uygulama Durumu).

---

## 0. Uygulama Durumu — 4 Ağustos 2026

Rapor 31 Temmuz'da yazıldı. Aşağıdaki tablo, 31 Temmuz – 4 Ağustos arasında yapılan çalışmanın sonucudur. Raporun geri kalanı **değiştirilmedi** — özgün hâliyle duruyor ki neyin nasıl bulunduğu izlenebilsin.

### Durum tablosu

| ID | Başlık | Durum | Not |
|---|---|---|---|
| F-01 | Açık kayıt ucu → yetki yükseltme | ✅ Kapandı | `kayitKorumasi.js` — kullanıcı tablosu boşken açık, sonrasında admin gerekli |
| F-02 | Kimlik doğrulaması olmayan okuma uçları | ✅ Kapandı | `routes/index.js`'te `router.use(dogrula)` — varsayılan korumalı |
| F-03 | Satınalma teslim alma çift işlenebiliyor | ✅ Kapandı, **doğrulandı** | `FOR UPDATE` + koşullu `UPDATE`; paralel `curl` ile test edildi (200 → 210, 220 değil) |
| F-04 | Satış teslim etme çift işlenebiliyor | ✅ Kapandı | Aynı kalıp |
| F-05 | Satınalma siparişi oluşturmada transaction yok | ✅ Kapandı | |
| F-06 | Pasif kullanıcı giriş yapabiliyor | ✅ Kapandı | `girisYap` artık `aktif` kontrol ediyor |
| F-07 | Brute-force koruması yok | ✅ Kapandı | `express-rate-limit`, 15 dk / 10 deneme |
| F-08 | CORS tüm kaynaklara açık | ✅ Kapandı | `config.corsOrigin` beyaz listesi |
| F-09 | Hata mesajı sızıntısı | ✅ Kapandı | `hataYonetici.js` üretimde detay vermiyor |
| F-10 | Güvenlik header'ları / gövde sınırı yok | ✅ Kapandı | `helmet`, `express.json({ limit: "200kb" })` |
| F-11 | Çift kayıtlı stok → kaçınılmaz drift | ✅ Yapısal sebep kaldırıldı | `varyant_lokasyon` düşürüldü, yerine `stok_birimleri` — dağılım tek kaynakta. `urun_varyantlari.miktar` hâlâ ayrı bir toplam olarak duruyor (aşağıya bkz.) |
| F-12 | Satış teslimde deadlock riski | ✅ Kapandı | Kilitler her yerde sabit ölçüte göre sıralı alınıyor |
| F-13 | Rezervasyon / tahsis mekanizması yok | ❌ Açık | Sipariş oluşturmak hâlâ stoğu bloke etmiyor |
| F-14 | Sipariş iptali transaction'sız | ✅ Fiilen kapandı | Tek ifadeli koşullu `UPDATE`, atomik. Yalnızca `beklemede` sipariş iptal edilebiliyor, o da stoğa dokunmamış oluyor |
| F-15 | İdempotanlık anahtarı yok | ❌ Açık | Koşullu `UPDATE`'ler çift işlemeyi engelliyor ama gerçek idempotanlık anahtarı yok |
| F-16 | Bağlantı sızıntısı riski | ✅ Kapandı | Tüm işlem kullanan denetleyicilerde `try/finally` |
| F-17 | Sayfalanmayan listeler, `SELECT *` | ⚠️ Kısmen | Varyant, stok hareketleri, transfer, stok birimleri sayfalanıyor. Müşteriler, tedarikçiler, satış ve satınalma siparişleri hâlâ sayfalanmıyor |
| F-18 | Döngü içinde tek tek `INSERT` | ⚠️ Kısmen | `blokOlustur` toplu `INSERT`'e geçti. `satinalmaController.teslimAl` kalem döngüsü duruyor |
| F-19 | Bağlantı havuzu yapılandırılmamış | ✅ Kapandı | `connectionLimit: 20`, `queueLimit: 50`, `enableKeepAlive` |
| F-20 | Kısmi kullanıcı güncellemesi patlıyor | ✅ Kapandı | Beyaz listeli dinamik `SET` |
| F-21 | Şema ve migration yönetimi yok | ⚠️ Kısmen | `backend/db/schema.sql` repoda ve güncel. Versiyonlanmış migration altyapısı hâlâ yok |
| F-22 | Sıfır test | ❌ Açık | **Raporun en büyük açık maddesi.** Her şey elle `curl` ve arayüz üzerinden doğrulandı |
| F-23 | Servis katmanı yok | ❌ Açık | SQL + iş kuralı + HTTP hâlâ aynı fonksiyonda |
| F-24 | Token saklama ve oturum yönetimi | ⚠️ Kısmen | `kullanicilar.token_surumu` eklendi; şifre değişince tüm oturumlar geçersiz oluyor. Token hâlâ `localStorage`'da |
| F-25 | Ortam ayrımı yok | ✅ Kapandı | `VITE_API_URL`; tanımsızsa uygulama açılışta duruyor |
| F-26 | `/test-db` ucu sızdırıyor | ✅ Kapandı | `/saglik` — DB hatası sızdırmıyor |
| F-27 | `.env.example` eksik, env doğrulaması yok | ✅ Kapandı | `config/env.js` başlangıçta doğruluyor ve gerekirse süreci sonlandırıyor |
| F-28 | Bağımlılık güvenlik açıkları | ✅ Kapandı | Backend `npm audit` → 0 açık. Frontend `react-router` bulgusu gerekçeli **kabul edilen risk** (bkz. F-28 bölümü) |
| F-29 | Girdi doğrulama şeması yok | ❌ Açık | Doğrulama her denetleyicide elle. Tarih biçimi ve miktar kontrolleri eklendi ama şema tabanlı değil |
| F-30 | Gözlemlenebilirlik ve operasyon | ⚠️ Kısmen | `/saglik` (liveness) ve `/sistem/kontroller` (veri bütünlüğü) var. Graceful shutdown ve yapılandırılmış log yok |
| F-31 | Frontend kod kalitesi | ❌ Açık | `index.css` hâlâ tek dosya; bazı `catch` blokları hatayı yutuyor |

**Özet:** 31 bulgunun **19'u tamamen kapandı**, **6'sı kısmen**, **6'sı açık.** Kritik ve yüksek önemli güvenlik bulgularının tamamı kapandı.

### Raporda olmayan, sonradan bulunan ve düzeltilen

| Bulgu | Durum |
|---|---|
| **Saat dilimi karışıklığı** — rapor tarih aralığı UTC ile hesaplanıyor, kayıtlar yerel saatle tutuluyordu. Gece 00:00–03:00 arası girilen hareketler bir önceki güne düşüyordu | ✅ `utils/tarih.js`, yarı açık aralık, biçim doğrulaması |
| **Sayım varyant bazlıydı** — aynı lokasyonda aynı üründen iki palet varsa ikisi tek satır sayılıyordu | ✅ Sayım birim bazlı hale getirildi |
| **`paletteki_adet` yanlış model** — palet başına adet sabit varsayılmıştı; gerçekte palet palet değişiyor. Kapasite kontrolü sahte uyarı üretiyordu | ✅ Kolon kaldırıldı, kapasite `COUNT(*) WHERE tip='palet'` ile hesaplanıyor |

### Rapor kapsamı dışında eklenen yetenekler

- **Palet (LPN) modeli.** Her fiziksel taşıma birimi kendi kaydı: `stok_birimleri` (`tip='palet'` kodlu, `tip='dokme'` kodsuz). Palet başına miktar sabit değil, her palet kendi sayısını taşıyor. Bu, F-11'in yapısal çözümü oldu.
- **Barkod ile palet sorgulama.** `GET /stok-birimleri/kod/:kod`. Okuyucu klavye gibi çalıştığı için ek entegrasyon gerekmiyor — rapordaki 5.3 maddesinin temeli atıldı.
- **Birim bazlı toplama.** Satış teslim edilirken hangi paletten/dökmeden kaç adet çıkacağını kullanıcı seçiyor; sunucu toplamı siparişle birebir doğruluyor.
- **Şifre değiştirme + oturum sonlandırma.** `token_surumu` ile diğer cihazların oturumu düşüyor.
- **Sistem sağlığı ekranı.** Stok sapması, negatif stok, pasif lokasyonda stok, kapasite aşımı — dört kontrol, admin'e kapalı bir sayfada.
- **Panel grafikleri.** Son 14 gün giriş/çıkış, en çok hareket gören 10 kalem, bölgelere göre dağılım.

---

## 1. Yönetici Özeti

1. **`POST /auth/kayit` kimlik doğrulaması olmadan açık ve `rol` alanını istek gövdesinden kabul ediyor.** İnternete açık bir kurulumda herkes tek bir HTTP isteğiyle kendine `admin` hesabı yaratabilir. Sistemdeki tüm yetkilendirme bu noktada anlamsızlaşıyor. (F-01)
2. **Okuma uçlarının büyük çoğunluğunda `dogrula` middleware'i yok.** Ürünler, varyantlar, stok seviyeleri, tüm stok hareketleri, satış/satınalma siparişleri, lokasyonlar ve **müşteri/tedarikçi kişisel verileri (telefon, e-posta, adres)** token'sız okunabiliyor. (F-02)
3. **Satınalma teslim alma ve satış teslim etme işlemlerinde durum kontrolü transaction dışında ve kilitsiz yapılıyor.** Aynı butona iki kez basmak veya bir retry, aynı siparişin stoğunu **iki kez** işleyebilir — satınalmada hayali stok, satışta eksi stok. WMS için en tehlikeli veri bütünlüğü hatası. (F-03, F-04)
4. **Satınalma siparişi oluşturma hiç transaction kullanmıyor.** Kalem eklerken oluşan bir hata, kalemleri eksik/boş bir sipariş başlığı bırakıyor; bu sipariş teslim alındığında eksik mal girişi yapılıyor. (F-05)
5. **Pasife alınan kullanıcı giriş yapmaya devam edebiliyor.** `girisYap` fonksiyonu `aktif` kolonunu hiç kontrol etmiyor; admin panelindeki "pasife al" işlemi güvenlik açısından hiçbir şey yapmıyor. (F-06)
6. **Stok iki ayrı yerde tutuluyor** (`urun_varyantlari.miktar` toplamı ve `varyant_lokasyon.miktar` dağılımı) ve bunlar ayrı ayrı `UPDATE`'lerle güncelleniyor. Kayması kaçınılmaz; nitekim kodda bir `/lokasyonlar/tutarlilik` teşhis ucu var — ama sadece farkı raporluyor, düzeltmiyor. (F-11)
7. **Rezervasyon/tahsis kavramı yok.** Sipariş oluşturmak stoğu bloke etmiyor; aynı stok sınırsız sayıda siparişe satılabiliyor, sorun ancak teslim anında ortaya çıkıyor. (F-13)
8. **Giriş ucunda hiç rate limiting / brute-force koruması yok**, `helmet` yok, CORS tamamen açık, hata yakalayıcı ham SQL hata mesajlarını istemciye döndürüyor. (F-07, F-08, F-09, F-10)
9. **Sıfır test, sıfır migration, sıfır ortam ayrımı.** `npm test` hata döndürüyor, şema değişiklikleri elle uygulanıyor, frontend `http://localhost:3000` adresini kodda sabit tutuyor — bu haliyle production build'i çalışmaz. (F-21, F-22, F-25)
10. **Sayfalanmayan liste uçları** (müşteriler, tedarikçiler, tüm satış ve satınalma siparişleri) tablolar büyüdükçe ilk kırılma noktası olacak. (F-17)

**Olumlu bulgular:** SQL enjeksiyonuna açık tek bir sorgu bulunamadı — dinamik filtreler dahil her yerde parametreli sorgu kullanılmış, dinamik `ORDER BY`/tablo adı birleştirmesi yok. `dangerouslySetInnerHTML` veya `eval` kullanımı yok. `backend/.env` git geçmişinde hiç yer almamış ve `.gitignore`'da. Parola hash'leme bcrypt cost 10 ile yapılıyor (kabul edilebilir). Stok çıkış ve transfer yollarında `SELECT ... FOR UPDATE` kullanılmış — doğru refleks, ama aşağıda anlatıldığı gibi eksik uygulanmış.

---

## 2. Bulgu Tablosu

| ID | Kategori | Önem | Başlık | Dosya:satır |
|---|---|---|---|---|
| F-01 | Güvenlik | **Kritik** | Açık kayıt ucu + gövdeden rol atama → yetki yükseltme | `backend/routes/authRoutes.js:6`, `backend/controllers/authController.js:7,17` |
| F-02 | Güvenlik | **Kritik** | Okuma uçlarının çoğunda kimlik doğrulama yok (PII dahil) | `backend/routes/*.js` (aşağıda liste) |
| F-03 | Eşzamanlılık | **Kritik** | Satınalma teslim alma: transaction dışı durum kontrolü → çift stok girişi | `backend/controllers/satinalmaController.js:81-94` |
| F-04 | Eşzamanlılık | **Kritik** | Satış teslim etme: transaction dışı durum kontrolü → çift stok çıkışı | `backend/controllers/satisController.js:88-108` |
| F-05 | Veri bütünlüğü | **Yüksek** | Satınalma siparişi oluşturmada transaction yok → yarım sipariş | `backend/controllers/satinalmaController.js:34-66` |
| F-06 | Güvenlik | **Yüksek** | `aktif=false` kullanıcı giriş yapabiliyor | `backend/controllers/authController.js:35-54` |
| F-07 | Güvenlik | **Yüksek** | Giriş ucunda brute-force koruması / rate limiting yok | `backend/routes/authRoutes.js:5` |
| F-08 | Güvenlik | **Yüksek** | CORS tüm kaynaklara açık | `backend/index.js:10` |
| F-09 | Güvenlik | **Orta** | Hata yakalayıcı ham hata mesajını istemciye sızdırıyor | `backend/middleware/hataYonetici.js:3-5` |
| F-10 | Güvenlik | **Orta** | Güvenlik header'ları yok (helmet), gövde boyutu sınırsız | `backend/index.js:10-11` |
| F-11 | Veri bütünlüğü | **Yüksek** | Çift kayıtlı stok (toplam + lokasyon) → kaçınılmaz drift | `stokHareketiController.js:156-177`, `lokasyonController.js:285-303` |
| F-12 | Eşzamanlılık | **Yüksek** | Satış teslimde değişken kilit sırası → deadlock riski | `backend/controllers/satisController.js:122-130` |
| F-13 | Mimari | **Yüksek** | Rezervasyon/tahsis mekanizması yok → aşırı satış | `backend/controllers/satisController.js:36-81` |
| F-14 | Eşzamanlılık | **Orta** | Sipariş iptali transaction'sız → "hem teslim hem iptal" durumu | `backend/controllers/satisController.js:205-232` |
| F-15 | Eşzamanlılık | **Orta** | İdempotanlık anahtarı hiçbir yazma ucunda yok | tüm `POST`/`PATCH` uçları |
| F-16 | Dayanıklılık | **Orta** | `catch` içinde `rollback` patlarsa bağlantı havuza dönmüyor | 6 controller, ör. `satisController.js:198-202` |
| F-17 | Performans | **Orta** | Sayfalanmayan liste uçları, `SELECT *` | `musteriController.js:5`, `tedarikciController.js:5`, `satisController.js:5-12`, `satinalmaController.js:5-14` |
| F-18 | Performans | **Orta** | Döngü içinde tek tek `INSERT` (N+1 yazma) | `lokasyonController.js:256-264`, `satinalmaController.js:53-58` |
| F-19 | Performans | **Orta** | Bağlantı havuzu ayarları yapılandırılmamış | `backend/config/db.js:4-10` |
| F-20 | Kod kalitesi | **Orta** | Kısmi kullanıcı güncellemesi `undefined` bind parametresiyle patlıyor | `backend/controllers/kullaniciController.js:31-34` |
| F-21 | Sürdürülebilirlik | **Yüksek** | Şema/migration dosyası yok | repoda yok |
| F-22 | Sürdürülebilirlik | **Yüksek** | Sıfır test | `backend/package.json:8` |
| F-23 | Mimari | **Orta** | Servis katmanı yok; SQL + iş kuralı + HTTP aynı fonksiyonda | tüm `backend/controllers/` |
| F-24 | Güvenlik | **Orta** | JWT `localStorage`'da, iptal/refresh mekanizması yok | `frontend/src/api/axios.js:8`, `frontend/src/pages/Giris.jsx:39` |
| F-25 | Operasyon | **Orta** | API adresi kodda sabit → ortam ayrımı yok | `frontend/src/api/axios.js:4` |
| F-26 | Güvenlik | **Orta** | `/test-db` ucu kimlik doğrulamasız, DB hatasını sızdırıyor | `backend/index.js:17-24` |
| F-27 | Güvenlik | **Orta** | `.env.example` `JWT_SECRET` içermiyor; başlangıçta env doğrulaması yok | `backend/.env.example` |
| F-28 | Bağımlılık | **Orta** | `react-router` 7.18.1 — yüksek önemli güvenlik danışmanlığı | `frontend/package.json:12` |
| F-29 | Girdi doğrulama | **Orta** | Şema tabanlı istek doğrulaması yok, tip zorlaması elle | tüm controller'lar |
| F-30 | Operasyon | **Orta** | Health check, graceful shutdown, yapılandırılmış log yok | `backend/index.js` |
| F-31 | Kod kalitesi | **Düşük** | Frontend'de yutulan hatalar, 1850 satırlık tek CSS dosyası | `StokHareketleri.jsx:95`, `frontend/src/index.css` |

---

## 3. Detaylı Bulgular

### F-01 — Açık kayıt ucu üzerinden admin yetkisi alma · **Kritik**

**Ne:** `/auth/kayit` ucu hiçbir middleware olmadan tanımlanmış ve rolü istek gövdesinden alıyor.

```js
// backend/routes/authRoutes.js:6
router.post("/kayit", authController.kayitOl);      // dogrula YOK, izinVer YOK
```
```js
// backend/controllers/authController.js:7,17
const { ad, email, sifre, rol } = req.body;
...
"INSERT INTO kullanicilar (ad, email, sifre_hash, rol) VALUES (?, ?, ?, ?)",
[ad, email, sifre_hash, rol || "depo_sorumlusu"],
```

**Neden önemli:** `izinVer("admin")` ile korunan her şey (kullanıcı yönetimi, lokasyon silme, blok oluşturma, tutarlılık raporu) bu tek uçla aşılıyor. Sömürü tek satır:

```
curl -X POST http://<host>:3000/auth/kayit \
  -H 'Content-Type: application/json' \
  -d '{"ad":"x","email":"x@x.com","sifre":"x","rol":"admin"}'
```

Dönen 201 yanıtından sonra `/auth/giris` ile admin token alınıyor. Bu, yatay değil doğrudan **dikey yetki yükseltmesi**.

**Düzeltme:** İki ayrı karar gerekli:
1. `rol` alanını gövdeden **asla** kabul etme — kayıt her zaman `depo_sorumlusu` yaratsın, rol değişimi yalnızca `PATCH /kullanicilar/:id` üzerinden (zaten admin korumalı) yapılsın.
2. Kayıt ucunu ya tamamen `dogrula + izinVer("admin")` arkasına al (kapalı kurulum), ya da ilk kullanıcı hariç kapat (`SELECT COUNT(*) FROM kullanicilar` = 0 ise izin ver, bootstrap deseni).

**Efor:** S (< 1 saat)

---

### F-02 — Kimlik doğrulaması olmayan okuma uçları · **Kritik**

**Ne:** `GET` uçlarının çoğunda `dogrula` middleware'i yok. Doğrulanmış tam liste:

| Uç | Dosya:satır | Sızan veri |
|---|---|---|
| `GET /urunler`, `GET /urunler/:id` | `urunRoutes.js:7-8` | Ürün kataloğu, toplam stok |
| `GET /varyantlar` | `varyantRoutes.js:7` | Varyant, barkod, **birim fiyat**, stok |
| `GET /varyantlar/dusuk-stok` | `varyantRoutes.js:8` | Kritik seviyedeki stoklar |
| `GET /varyantlar/:id/lokasyonlar` | `varyantRoutes.js:12` | Hangi malın hangi rafta olduğu |
| `GET /musteriler` | `musteriRoutes.js:7` | **`SELECT *`** — ad, yetkili, telefon, e-posta, adres |
| `GET /tedarikciler` | `tedarikciRoutes.js:7` | **`SELECT *`** — aynı PII seti |
| `GET /satis-siparisleri`, `/:id/kalemler` | `satisRoutes.js:6-7` | Müşteri adı+telefonu, ciro, fiyatlar |
| `GET /satinalma-siparisleri`, `/:id/kalemler` | `satinalmaRoutes.js:6-7` | Tedarikçi adı+telefonu, alış fiyatları |
| `GET /stok-hareketleri` | `stokHareketleriRoutes.js:6` | Tüm hareket geçmişi + **işlemi yapan kullanıcı adı** |
| `GET /lokasyonlar`, `/:id/stok` | `lokasyonRoutes.js:13-14` | Depo yerleşimi ve raf içerikleri |
| `GET /kategoriler` | `kategoriRoutes.js:7` | Kategori listesi |

**Neden önemli:** Bu, kimlik doğrulama gerektirmeyen tam bir iş zekâsı sızıntısı — müşteri listesi, tedarikçi listesi, alış ve satış fiyatları, ciro, stok seviyeleri ve depo yerleşimi. KVKK açısından müşteri/tedarikçi telefon-eposta-adres verisinin anonim erişime açık olması ayrıca raporlanabilir bir ihlal. F-08'deki açık CORS ile birleşince, kullanıcının ziyaret ettiği herhangi bir web sitesi bu verileri tarayıcıdan çekip dışarı taşıyabilir.

Frontend'in `KorumaliRota` bileşeni (`frontend/src/components/KorumaliRota.jsx:5`) yalnızca `localStorage`'da token varlığına bakıyor — bu bir UX önlemi, güvenlik sınırı değil; API doğrudan çağrılabilir.

**Düzeltme:** Varsayılanı tersine çevir. `backend/routes/index.js` içinde, `/auth` hariç tüm router'ları global `dogrula` arkasına al:

```js
router.use("/auth", require("./authRoutes"));
router.use(dogrula);                      // bundan sonrası kimlik ister
router.use("/urunler", require("./urunRoutes"));
// ...
```
Böylece yeni eklenen her uç varsayılan olarak korunur; istisna gerekiyorsa bilinçli olarak yazılır. Ayrıca `musteriController.js:5` ve `tedarikciController.js:5`'teki `SELECT *` yerine açık kolon listesi kullanılmalı.

**Efor:** S (< 1 saat, + regresyon testi)

---

### F-03 — Satınalma teslim alma çift işlenebiliyor · **Kritik**

**Ne:** Sipariş durumu kontrolü `beginTransaction()` çağrısından **önce** ve `FOR UPDATE` kilidi olmadan yapılıyor.

```js
// backend/controllers/satinalmaController.js:81-94
const [siparisRows] = await connection.query(          // ← autocommit, kilitsiz
  "SELECT * FROM satinalma_siparisleri WHERE id = ?", [id],
);
...
if (siparisRows[0].durum === "teslim_alindi") {        // ← kontrol
  connection.release();
  return res.status(400).json({ hata: "Bu sipariş zaten teslim alınmış" });
}

await connection.beginTransaction();                    // ← transaction ANCAK burada başlıyor
```

**Neden önemli / sömürü senaryosu:** İki eşzamanlı `PATCH /satinalma-siparisleri/5/teslim-al` isteği (çift tıklama, ağ retry'ı, el terminalinin tekrar göndermesi):

1. İstek A okur → `durum = 'beklemede'` → geçer
2. İstek B okur → `durum = 'beklemede'` → geçer (A henüz commit etmedi)
3. A transaction'ı başlatır, tüm kalemleri stoğa ekler, durumu `teslim_alindi` yapar, commit eder
4. B transaction'ı başlatır, **aynı kalemleri ikinci kez stoğa ekler**, durumu tekrar `teslim_alindi` yapar, commit eder

Sonuç: depoda fiziksel olarak olmayan mal sistemde görünüyor, `stok_hareketleri`'nde iki adet `giris` kaydı var. Bu hata sessiz — hiçbir yerde hata dönmüyor, sadece sayım yapılana kadar fark edilmiyor.

`frontend/src/components/TeslimAlModal.jsx:49`'daki `disabled={gonderiliyor}` sadece tek sekmedeki çift tıklamayı engelliyor; ağ katmanındaki retry'ı veya iki sekmeyi engellemiyor.

**Düzeltme:** Okumayı transaction'ın içine al ve satırı kilitle:

```js
await connection.beginTransaction();
const [siparisRows] = await connection.query(
  "SELECT * FROM satinalma_siparisleri WHERE id = ? FOR UPDATE", [id],
);
// durum kontrolleri artık burada
```
Ek olarak, durum güncellemesini koşullu yaparak ikinci bir savunma hattı kurulabilir:
`UPDATE ... SET durum='teslim_alindi' WHERE id=? AND durum<>'teslim_alindi'` ve `affectedRows === 0` ise rollback.

**Efor:** S

---

### F-04 — Satış teslim etme çift işlenebiliyor · **Kritik**

**Ne:** F-03 ile birebir aynı desen.

```js
// backend/controllers/satisController.js:88-108
const [siparisRows] = await connection.query(
  "SELECT * FROM satis_siparisleri WHERE id = ?", [id],   // ← kilitsiz, transaction dışı
);
if (siparisRows[0].durum === "teslim_edildi") { ... }
if (siparisRows[0].durum === "iptal") { ... }

await connection.beginTransaction();                       // ← geç kalmış
```

**Neden önemli:** Satınalma tarafındaki etkinin tersi ve daha kötüsü — aynı sipariş iki kez stoktan düşülüyor. Stok kontrolü (`satisController.js:139`) ikinci çalıştırmada yeterli stok bulursa sessizce geçer; bulamazsa `400` döner ama **ilk çalıştırma zaten commit edilmiştir**, yani müşteriye bir kez gönderilen mal sistemden iki kez düşülür. `varyant_lokasyon.miktar` için `UPDATE ... miktar = miktar - ?` kısıtsız çalıştığından (F-11'e bakınız, `CHECK` kısıtı doğrulanamadı) **negatif stok** oluşabilir.

**Düzeltme:** F-03 ile aynı — `beginTransaction()` en başa, sipariş `SELECT`'i `FOR UPDATE` ile transaction içine.

**Efor:** S

---

### F-05 — Satınalma siparişi oluşturma transaction kullanmıyor · **Yüksek**

**Ne:** Sipariş başlığı ve kalemleri ayrı ayrı `pool.query` ile, transaction olmadan yazılıyor.

```js
// backend/controllers/satinalmaController.js:47-58
const [siparisResult] = await pool.query(
  "INSERT INTO satinalma_siparisleri (...) VALUES (?, 'beklemede', ?, ?)", ...);
const siparis_id = siparisResult.insertId;

for (const kalem of kalemler) {
  await pool.query(                                  // ← her biri ayrı bağlantı, ayrı commit
    "INSERT INTO satinalma_siparis_kalemleri (...) VALUES (?, ?, ?, ?)", ...);
}
```

**Neden önemli:** 5 kalemlik bir siparişte 3. kalem hata verirse (geçersiz `varyant_id`, FK ihlali, bağlantı kopması), veritabanında **2 kalemli ama toplam tutarı 5 kalem üzerinden hesaplanmış** bir sipariş kalır. Bu sipariş teslim alındığında yalnızca 2 kalem stoğa girer, kalan 3 kalem sessizce kaybolur — ve sipariş `teslim_alindi` olarak kapanır, bir daha işlenemez. Kayıp mal.

Dikkat çekici olan: `satisController.olustur` (`satisController.js:53-70`) **aynı işi doğru şekilde**, transaction içinde yapıyor. Yani bu bir bilgi eksikliği değil, tutarsız uygulama.

Ayrıca `tedarikci_id` doğrulanmıyor (`satinalmaController.js:36`) — `null` bir tedarikçiyle sipariş açılabilir; `listele` ise `JOIN tedarikciler` kullandığı için (`satinalmaController.js:8`) bu sipariş listede **hiç görünmez**. Görünmez sipariş.

**Düzeltme:** `satisController.olustur` desenini birebir uygula: `pool.getConnection()` + `beginTransaction` + `commit`/`rollback`. Ek olarak `tedarikci_id` zorunlu kılınmalı ve kalem alanları (`miktar > 0`, `birim_fiyat >= 0`, `varyant_id` var mı) doğrulanmalı. `LEFT JOIN` kullanmak da görünmez sipariş sorununu maskeler ama kök nedeni çözmez.

**Efor:** S

---

### F-06 — Pasife alınmış kullanıcı giriş yapabiliyor · **Yüksek**

**Ne:** `girisYap` fonksiyonu `aktif` kolonunu hiç okumuyor.

```js
// backend/controllers/authController.js:35-54
const [rows] = await pool.query("SELECT * FROM kullanicilar WHERE email = ?", [email]);
if (!rows.length) return res.status(401).json(...);
const kullanici = rows[0];
const dogruMu = await bcrypt.compare(sifre, kullanici.sifre_hash);
if (!dogruMu) return res.status(401).json(...);
// ← aktif kontrolü yok
const token = jwt.sign({ id: kullanici.id, rol: kullanici.rol }, ...);
```

`aktif` kolonunun var olduğu kesin: `kullaniciController.js:6` onu `SELECT` ediyor, `kullaniciController.js:32` `UPDATE` ediyor ve `Kullanicilar.jsx` arayüzünde yönetiliyor.

**Neden önemli:** İşten ayrılan bir personeli admin panelden "pasife almak" hiçbir işe yaramıyor — kişi parolasını bildiği sürece sisteme girip stok hareketi yaratmaya devam edebilir. Yönetici, erişimi kestiğini sanır. Bu, güvenlik kontrolünün var olduğu ama uygulanmadığı en tehlikeli sınıftan bir hata.

**İkincil sorun:** Rol veya `aktif` değişikliği mevcut token'ları etkilemiyor. `dogrula` middleware'i (`backend/middleware/auth.js:15-16`) yalnızca imzayı doğrulayıp payload'daki `rol`'ü kullanıyor; veritabanına hiç bakmıyor. Admin'den `depo_sorumlusu`'na düşürülen bir kullanıcı, token'ının kalan süresi (8 saate kadar) boyunca admin olarak davranmaya devam eder.

**Düzeltme:**
1. `girisYap` içine `if (!kullanici.aktif) return res.status(403).json({ hata: "Hesabınız pasif durumda" });`
2. Orta vadede `dogrula` middleware'inde kullanıcıyı DB'den tazele (`aktif` ve `rol` kontrolü) — maliyeti istek başına bir indeksli `SELECT`, kabul edilebilir. Alternatifi token'lara `jti` + iptal listesi eklemek.
3. Rol/durum değiştiğinde `sifre_degisim_tarihi` benzeri bir alanla eski token'ları geçersizleştirmek en temiz çözüm.

**Efor:** S (madde 1), M (madde 2-3)

---

### F-07 — Brute-force koruması yok · **Yüksek**

**Ne:** `backend/routes/authRoutes.js:5` — `POST /auth/giris` hiçbir hız sınırı olmadan açık. Repoda `express-rate-limit` veya benzeri bir bağımlılık yok (`backend/package.json:17-24`), başarısız giriş denemesi sayacı yok, hesap kilitleme yok, CAPTCHA yok.

**Neden önemli:** Bilinen bir e-posta adresine karşı saniyede yüzlerce parola denemesi yapılabilir. bcrypt cost 10 her denemeyi ~50-100ms'e çıkarır, bu bir miktar doğal fren sağlar — ama aynı zamanda sunucuyu **CPU açısından savunmasız** bırakır: paralel 200 giriş isteği Node.js sürecini kilitleyebilir (bcryptjs saf JS implementasyonudur ve event loop'u bloklar; native `bcrypt` paketine göre belirgin şekilde yavaştır).

**Düzeltme:** `express-rate-limit` ile `/auth/giris` üzerinde IP başına dar bir limit (ör. 15 dakikada 10 deneme) + e-posta başına ayrı sayaç ve kademeli gecikme. `bcryptjs` yerine native `bcrypt` veya `argon2` kullanmak hem hızlandırır hem event loop'u serbest bırakır.

**Efor:** S

---

### F-08 — CORS tüm kaynaklara açık · **Yüksek**

**Ne:**
```js
// backend/index.js:10
app.use(cors({ exposedHeaders: ["X-Toplam-Kayit"] }));   // origin belirtilmemiş → "*"
```

**Neden önemli:** `origin` verilmediğinde `cors` paketi `Access-Control-Allow-Origin: *` döner. F-02 ile birleştiğinde: kullanıcının açtığı herhangi bir kötü niyetli web sayfası, JavaScript ile `http://<wms-host>:3000/musteriler` adresini çağırıp yanıtı okuyabilir ve dışarı gönderebilir. Token gerektirmeyen uçlar olduğu için bu tam bir cross-origin veri hırsızlığıdır.

Token gerektiren uçlar için risk daha düşük (token `localStorage`'da, tarayıcı otomatik göndermez) — ama F-24'teki XSS senaryosunda birleşik etki artar.

**Düzeltme:**
```js
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") ?? [],
  exposedHeaders: ["X-Toplam-Kayit"],
}));
```
ve `.env`'e `CORS_ORIGIN=https://wms.sirket.com` eklenmeli.

**Efor:** S

---

### F-09 — Hata mesajı sızıntısı · **Orta**

**Ne:**
```js
// backend/middleware/hataYonetici.js:1-6
const hataYonetici = (err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500)
     .json({ hata: err.message || "Sunucu hatası" });   // ← ham mesaj istemciye
};
```

**Neden önemli:** Controller'ların hiçbiri `err.statusCode` atamıyor (tüm dosyalarda arandı, tek bir örnek yok), yani buraya düşen her hata gerçek bir beklenmedik hatadır — MySQL hataları, bind parametresi hataları, bağlantı hataları. `err.message` bunlarda tablo adları, kolon adları, kısıt adları ve bazen sorgu parçaları içerir:

> `Duplicate entry '...' for key 'urun_varyantlari.barkod_UNIQUE'`
> `Bind parameters must not contain undefined`
> `ER_NO_REFERENCED_ROW_2: Cannot add or update a child row: a foreign key constraint fails (\`wms\`.\`satis_siparis_kalemleri\`, CONSTRAINT ...)`

Bu, saldırgana şema haritası çıkarır. `/test-db` ucu (F-26) aynısını daha doğrudan yapıyor: `res.json({ baglanti: "basarisiz", hata: err.message })` (`backend/index.js:22`) — bağlantı hatası mesajı DB host, port ve kullanıcı adını içerebilir.

**Düzeltme:** Bilinen/beklenen hatalar için `statusCode` taşıyan bir `AppError` sınıfı tanımla; `hataYonetici` yalnızca `err.isOperational === true` olanların mesajını döndürsün, diğerleri için sabit "Sunucu hatası" + sunucu tarafında `requestId` ile loglama yapsın. `/test-db` ucunu ya kaldır ya da admin arkasına al ve mesajı gizle.

**Efor:** S

---

### F-10 — Güvenlik header'ları ve gövde boyutu sınırı yok · **Orta**

**Ne:** `backend/index.js` içinde `helmet` yok; `express.json()` (`index.js:11`) varsayılan 100kb limitiyle çalışıyor ama bu `sayimController` gibi toplu uçlar için hem çok yüksek hem denetlenmemiş.

**Neden önemli:** `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy` header'larının yokluğu clickjacking ve MIME-sniffing sınıfı saldırılara kapı bırakır. Ayrıca `sayimController.kaydet` gövdedeki `kalemler` dizisini **sınırsız** dönüyor (`sayimController.js:24`) — 100kb'lik bir gövdeye binlerce kalem sığar ve her biri 4 ayrı sorgu çalıştırır (bkz. F-18), tek istekle uzun süreli transaction ve kilit birikimi yaratır.

**Düzeltme:** `app.use(helmet())`, `express.json({ limit: "200kb" })` ve `sayimController` içinde `kalemler.length` üst sınırı (ör. 500) + toplu `INSERT`.

**Efor:** S

---

### F-11 — Çift kayıtlı stok modeli ve kaçınılmaz drift · **Yüksek**

**Ne:** Stok iki bağımsız yerde tutuluyor:
- `urun_varyantlari.miktar` — varyantın toplam stoğu
- `varyant_lokasyon.miktar` — lokasyon bazında dağılım

Her stok hareketinde ikisi ayrı `UPDATE`'lerle güncelleniyor:

```js
// backend/controllers/stokHareketiController.js:156-166 (giris yolu)
await connection.query("UPDATE urun_varyantlari SET miktar = miktar + ? WHERE id = ?", ...);
await connection.query(
  `INSERT INTO varyant_lokasyon (varyant_id, lokasyon_id, miktar) VALUES (?, ?, ?)
   ON DUPLICATE KEY UPDATE miktar = miktar + ?`, ...);
```

**Neden önemli:** Bu klasik denormalizasyon tuzağı. Aynı transaction içinde oldukları sürece atomiktirler — ama:
- **Transfer işlemi** (`transferController.js:75-86`) yalnızca `varyant_lokasyon`'u günceller, `urun_varyantlari.miktar`'a dokunmaz — doğru davranış (toplam değişmiyor), ancak bu asimetri kodu kırılgan yapıyor.
- F-03/F-04'teki çift işleme senaryolarında ikisi birlikte bozulur.
- `varyant_lokasyon` satırı yokken yapılan `cikis` (`stokHareketiController.js:172-176`) `affectedRows = 0` döner ama **hata vermez** — `urun_varyantlari.miktar` düşer, lokasyon toplamı düşmez. Drift.
- `varyantController.ekle` (`varyantController.js:111`) doğrudan `miktar` alarak varyant yaratabiliyor; bu stok hiçbir lokasyona ve hiçbir `stok_hareketleri` kaydına bağlı değil — doğuştan drift.

Projede bu sorunun farkında olunduğunu gösteren bir teşhis ucu var:
```js
// backend/controllers/lokasyonController.js:285-297
`SELECT ... v.miktar - COALESCE(SUM(vl.miktar), 0) AS fark ... HAVING fark <> 0`
```
Ama bu uç **sadece raporluyor** — düzeltme mekanizması yok, uyarı yok, periyodik çalışmıyor.

**Ayrıca:** `stok_hareketleri` tablosu bir ledger (kayıt defteri) olarak duruyor ama **otorite değil**. Gerçek stok mutable `miktar` alanlarında. Bu, "hareketleri topladığımda mevcut stoğu bulmalıyım" garantisinin hiçbir yerde uygulanmadığı anlamına gelir; F-05'teki gibi bir hata ledger ile bakiyeyi kalıcı olarak ayırır ve geriye dönük denetim imkânsızlaşır.

**Düzeltme (kademeli):**
1. **Kısa vade:** `varyant_lokasyon.miktar` üzerine `CHECK (miktar >= 0)` kısıtı ekle (MySQL 8.0.16+ zorunlu kılar). `cikis` yolunda `affectedRows === 0` durumunu hata olarak ele al. `tutarlilik` ucunu günlük bir cron + uyarıya bağla.
2. **Orta vade:** `urun_varyantlari.miktar`'ı **tamamen kaldır**, toplamı `varyant_lokasyon` üzerinden bir view veya sorguyla hesapla. Tek kaynak, sıfır drift. `dusukStok` ve `listele` sorguları buna göre uyarlanır (bkz. F-17 için indeks notu).
3. **Uzun vade:** `stok_hareketleri`'ni tek otorite yap (event sourcing / ledger), `varyant_lokasyon`'u yeniden hesaplanabilir bir projeksiyon/materialized view olarak tut. Bu, her tutarsızlığın kaynağının bulunabilmesini ve stoğun herhangi bir geçmiş ana geri sarılabilmesini sağlar — WMS'te denetim için çok değerli.

**Efor:** S (1) / M (2) / L (3)

---

### F-12 — Satış teslimde deadlock riski · **Yüksek**

**Ne:** Kilitler kalem kalem, her kalem için de **miktara göre sıralanmış** biçimde alınıyor:

```js
// backend/controllers/satisController.js:121-130
for (const kalem of kalemler) {
  const [lokasyonStoklari] = await connection.query(
    `SELECT vl.lokasyon_id, vl.miktar, l.kod
     FROM varyant_lokasyon vl JOIN lokasyonlar l ON vl.lokasyon_id = l.id
     WHERE vl.varyant_id = ? AND vl.miktar > 0
     ORDER BY vl.miktar DESC                     -- ← kilit sırası veriye bağlı
     FOR UPDATE`, [kalem.varyant_id]);
```

**Neden önemli:** Deadlock'tan kaçınmanın temel kuralı, tüm transaction'ların kilitleri **aynı deterministik sırada** almasıdır. Burada iki bağımsız sıralama sorunu var:

1. **Kalemler arası:** Sipariş A `[varyant 7, varyant 3]`, Sipariş B `[varyant 3, varyant 7]` sırasıyla işlenirse, A varyant 7'yi kilitleyip 3'ü beklerken B varyant 3'ü kilitleyip 7'yi bekler → deadlock.
2. **Kalem içi:** `ORDER BY vl.miktar DESC` sıralaması *veriye* bağlı. Aynı varyant için iki eşzamanlı işlem, aradaki bir güncelleme yüzünden lokasyonları farklı sırada kilitleyebilir.

InnoDB deadlock'u tespit edip transaction'lardan birini geri alır (`ER_LOCK_DEADLOCK`), veri bozulmaz — ama kullanıcı sebepsiz bir "Sunucu hatası" görür (F-09 nedeniyle ham MySQL mesajı olarak) ve yoğun saatte teslimat işlemleri rastgele başarısız olur.

**Ek risk:** Bu `FOR UPDATE` sorgusu bir varyantın **tüm** lokasyon satırlarını kilitliyor, yalnızca ihtiyaç duyulanları değil. Çok lokasyonlu popüler bir üründe bu, eşzamanlılığı ciddi biçimde daraltır.

**Düzeltme:**
1. Kalemleri `varyant_id`'ye göre sırala ve **tekilleştir** (aynı varyanttan iki kalem varsa birleştir — şu an bu durumda stok iki kez ayrı ayrı kontrol edilip toplamda yetersiz kalabilir).
2. Kilit sorgusunda `ORDER BY vl.lokasyon_id` kullan (deterministik), tahsis önceliğini uygulama tarafında belirle.
3. `ER_LOCK_DEADLOCK` için sınırlı sayıda otomatik retry (ör. 3 deneme, üstel bekleme) ekle — bu tür sistemlerde standart pratiktir.

**Efor:** M

---

### F-13 — Rezervasyon / tahsis mekanizması yok · **Yüksek**

**Ne:** `satisController.olustur` (`satisController.js:36-81`) siparişi `beklemede` durumunda kaydeder ve **stoğa hiç dokunmaz**. Stok kontrolü ilk kez `teslimEt` içinde (`satisController.js:139`) yapılır.

**Neden önemli:** 100 adet stoğu olan bir ürün için 10 ayrı müşteriye 50'şer adetlik sipariş açılabilir. Sistem hiçbirinde uyarmaz. Teslim aşamasında ilk iki sipariş geçer, kalan sekizi "Yetersiz stok" hatasıyla reddedilir — yani problem, müşteriye söz verildikten ve mal hazırlanmaya başlandıktan **sonra** ortaya çıkar. Depo operasyonunda bu, en pahalı hata anıdır.

Ayrıca "kullanılabilir stok" kavramı hiç yok: `dusukStok` (`varyantController.js:69-82`) ve panel `toplam_stok` (`urunController.js:30`) fiziksel stoğu gösteriyor, bekleyen siparişlere söz verilmiş miktarı değil. Satın alma kararları bu yanlış sayıya göre veriliyor.

**Düzeltme:** `varyant_lokasyon`'a `rezerve_miktar` kolonu (veya ayrı bir `stok_rezervasyonlari` tablosu) ekle:
- Sipariş oluşturulurken rezervasyon yaz, `mevcut - rezerve < gereken` ise siparişi reddet
- Teslimde rezervasyonu düş ve fiziksel stoğu düş
- İptalde rezervasyonu serbest bırak (bu, F-14'ü de çözer)
- Tüm "kullanılabilir stok" gösterimlerini `miktar - rezerve_miktar` üzerinden hesapla

Ayrı tablo yaklaşımı tercih edilmeli: rezervasyonun kime ait olduğu, ne zaman yapıldığı ve zaman aşımı takip edilebilir.

**Efor:** L

---

### F-14 — Sipariş iptali transaction'sız · **Orta**

**Ne:**
```js
// backend/controllers/satisController.js:205-232
const [rows] = await pool.query("SELECT durum FROM satis_siparisleri WHERE id = ?", [id]);
if (rows[0].durum === "teslim_edildi") return res.status(400).json(...);
await pool.query("UPDATE satis_siparisleri SET durum = 'iptal' WHERE id = ?", [id]);
```

Klasik oku-kontrol-et-yaz yarışı; üstelik iki ayrı `pool.query` çağrısı **farklı bağlantılar** kullanabilir.

**Neden önemli:** Eşzamanlı bir `teslimEt` ile yarışırsa: iptal `durum='beklemede'` okur, teslim işlemi stoğu düşüp `teslim_edildi` yazar, ardından iptal `durum='iptal'` yazar. Sonuç: mal fiziksel olarak çıkmış, stok düşülmüş, `stok_hareketleri`'nde çıkış kaydı var — ama sipariş "iptal" görünüyor. Muhasebe ile depo kalıcı olarak çelişir.

**Düzeltme:** Koşullu tek `UPDATE` yeterli, transaction'a bile gerek yok:
```js
const [sonuc] = await pool.query(
  "UPDATE satis_siparisleri SET durum='iptal' WHERE id=? AND durum='beklemede'", [id]);
if (sonuc.affectedRows === 0) { /* 404 mü 400 mü ayırt etmek için tekrar oku */ }
```

**Efor:** S

---

### F-15 — İdempotanlık anahtarı yok · **Orta**

**Ne:** Hiçbir yazma ucunda `Idempotency-Key` benzeri bir mekanizma yok. `stok_hareketleri` tablosunda tekrarları engelleyecek bir doğal anahtar da yok.

**Neden önemli:** F-03/F-04'teki durum kilitleri, sipariş tabanlı işlemleri korur. Ancak `POST /stok-hareketleri` ve `POST /transferler` **doğaları gereği tekrarlanabilir** işlemlerdir — "A rafından 10 adet çıkar" isteği iki kez gelirse ikisi de meşru görünür ve 20 adet çıkar. Depoda kablosuz el terminali kullanılan bir senaryoda (bağlantı kesintisi + otomatik retry) bu düzenli olarak yaşanır.

`frontend/src/pages/Sayim.jsx:107-125` içindeki `kaydet` fonksiyonunda in-flight koruması yok (modal kapanıyor ama istek devam ediyor); `SatisSiparisleri.jsx:169-179` `teslimEtOnayla` da aynı şekilde korumasız. `TeslimAlModal.jsx:49` ise korumalı — tutarsız.

**Düzeltme:** Yazma uçlarında `Idempotency-Key` header'ı kabul et; `islem_anahtarlari (anahtar VARCHAR(64) PRIMARY KEY, yanit JSON, olusturulma TIMESTAMP)` tablosuna transaction içinde `INSERT` et — `ER_DUP_ENTRY` alırsan saklanan yanıtı döndür. İstemci tarafında anahtar, form açıldığında `crypto.randomUUID()` ile üretilir. Bu tek mekanizma tüm yazma uçlarını korur.

**Efor:** M

---

### F-16 — Bağlantı sızıntısı riski · **Orta**

**Ne:** Transaction kullanan altı controller'da da aynı desen:

```js
// backend/controllers/satisController.js:198-202 (temsili)
} catch (err) {
  await connection.rollback();     // ← burası patlarsa
  connection.release();            // ← buraya hiç gelinmez
  next(err);
}
```

**Neden önemli:** `rollback()` bağlantı kopmuş bir soket üzerinde çağrılırsa (`PROTOCOL_CONNECTION_LOST`, sunucu tarafı timeout) hata fırlatır; `release()` atlanır ve bağlantı havuza dönmez. Bu, kalıcı bir sızıntıdır. mysql2'nin varsayılan `connectionLimit` değeri 10'dur ve `db.js`'te değiştirilmemiştir (F-19) — yani **10 böyle olay tüm uygulamayı kalıcı olarak kilitler**. Sonraki her istek `pool.getConnection()`'da süresiz bekler; sunucu yeniden başlatılana kadar kurtulmaz.

Ayrıca `catch` bloğu, hata `beginTransaction()`'dan önce oluştuğunda da (`teslimAl`'da satır 81'deki `SELECT` gibi) `rollback` çağırıyor — bu MySQL'de zararsız ama niyeti bulanıklaştırıyor.

**Düzeltme:** `try/finally` kullan ve `release`'i garanti altına al:

```js
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  // ...
  await connection.commit();
} catch (err) {
  await connection.rollback().catch(() => {});
  next(err);
} finally {
  connection.release();
}
```
Daha iyisi: bu deseni `withTransaction(async (conn) => { ... })` yardımcı fonksiyonuna çıkar (F-23 ile birlikte) — böylece altı yerde tekrarlanan boilerplate tek yerde doğru yazılır.

**Efor:** S

---

### F-17 — Sayfalanmayan listeler ve `SELECT *` · **Orta**

**Ne:** Sayfalama yalnızca üç uçta var (`urunController.js:39`, `varyantController.js:54`, `stokHareketiController.js:64`) ve orada bile **isteğe bağlı** — `sayfa`/`limit` parametresi gönderilmezse tüm tablo dönüyor. Sayfalanmayan uçlar:

| Uç | Dosya:satır | Not |
|---|---|---|
| `GET /musteriler` | `musteriController.js:5` | `SELECT *`, limitsiz |
| `GET /tedarikciler` | `tedarikciController.js:5` | `SELECT *`, limitsiz, `ORDER BY` bile yok |
| `GET /satis-siparisleri` | `satisController.js:5-12` | Tüm siparişler, her zaman |
| `GET /satinalma-siparisleri` | `satinalmaController.js:5-9` | Tüm siparişler, her zaman |
| `GET /lokasyonlar` | `lokasyonController.js:5-13` | Tüm lokasyonlar + `GROUP BY` toplama |
| `GET /varyantlar/dusuk-stok` | `varyantController.js:71-77` | Limitsiz |
| `GET /transferler` | `transferController.js:17` | `LIMIT 100` kodda sabit, sayfalama yok |

**Neden önemli — 10x veri senaryosu:** İlk kırılma noktası **satış/satınalma sipariş listeleri**. Bunlar zamanla monoton artan tablolardır; 50.000 siparişte her sayfa açılışı 50.000 satırı JOIN'leyip JSON'a çevirip tel üzerinden gönderir. Node.js tarafında JSON serileştirme senkron olduğu için event loop birkaç yüz milisaniye bloklanır ve **tüm eşzamanlı isteklere** yansır. Frontend tarafında `SatisSiparisleri.jsx` bu diziyi sanallaştırma olmadan render ettiği için tarayıcı da kilitlenir.

İkinci kırılma noktası `GET /lokasyonlar`: `LEFT JOIN varyant_lokasyon` + `GROUP BY l.id` her çağrıda tüm stok dağılımını tarar. `blokOlustur` ile üretilen palet yerleri düşünüldüğünde (blok × sıra × derinlik × kat) bu tablo hızla on binlere çıkar ve `DepoHaritası.jsx` bunu her açılışta çeker.

Üçüncüsü, `stok_hareketleri` üzerindeki offset tabanlı sayfalama (`stokHareketiController.js:67-69`): `LIMIT ? OFFSET ?` derin sayfalarda MySQL'i offset'e kadar olan tüm satırları taramaya zorlar. Milyonlarca hareket kaydında 5.000. sayfa pratikte açılmaz.

**Düzeltme:**
1. Tüm liste uçlarında sayfalamayı **zorunlu** kıl ve sunucu tarafında bir `MAX_LIMIT` (ör. 100) uygula.
2. `SELECT *` yerine açık kolon listesi (F-02 ile aynı düzeltme).
3. `stok_hareketleri` gibi büyüyen tablolarda offset yerine keyset (cursor) sayfalaması: `WHERE (tarih, id) < (?, ?) ORDER BY tarih DESC, id DESC LIMIT ?`.
4. Şema erişimi sağlandığında indeksleri doğrula — en azından: `varyant_lokasyon(varyant_id, lokasyon_id)` UNIQUE (kod bunu varsayıyor, `ON DUPLICATE KEY` çalışması için zorunlu), `varyant_lokasyon(lokasyon_id)`, `stok_hareketleri(tarih)`, `stok_hareketleri(varyant_id, tarih)`, `stok_hareketleri(lokasyon_id)`, `satis_siparisleri(siparis_tarihi)`, `satis_siparis_kalemleri(siparis_id)`, `kullanicilar(email)` UNIQUE.

**Efor:** M

---

### F-18 — Döngü içinde tek tek `INSERT` · **Orta**

**Ne:** Üç yerde N ayrı sorgu, tek toplu sorgu yerine:

```js
// backend/controllers/lokasyonController.js:256-264 — en kritiği
for (const kayit of kayitlar) {
  const [sonuc] = await connection.query(
    `INSERT IGNORE INTO lokasyonlar (...) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'palet', 1)`,
    kayit);
  olusan += sonuc.affectedRows;
}
```

**Neden önemli:** `blokOlustur` kayıt sayısı `sira_sayisi × derinlik × kat` ile üstel büyür. 40 sıra × 4 derinlik × 5 kat = **800 ayrı `INSERT`**, hepsi tek transaction içinde, her biri bir ağ gidiş-dönüşü. Yerel MySQL'de bile birkaç saniye, uzak DB'de dakikalar sürer ve bu süre boyunca `lokasyonlar` tablosunda kilitler tutulur. Girdiler `parseInt` ile alınıyor ama **üst sınır kontrolü yok** (`lokasyonController.js:206-212`) — kötü niyetli veya hatalı bir istek (`sira_sayisi: 100000`) milyonlarca satır üretmeye çalışır. Bu, kimliği doğrulanmış bir admin gerektirir, ama kaza sonucu tetiklenmesi de mümkündür.

Aynı desen `satinalmaController.js:53-58` (sipariş kalemleri) ve `satinalmaController.js:101-126` (teslim alma, kalem başına 3 sorgu) ile `sayimController.js:24-89` (kalem başına 4 sorgu) içinde de var.

**Düzeltme:** mysql2 toplu `INSERT` destekler:
```js
await connection.query(
  `INSERT IGNORE INTO lokasyonlar (kod, blok, ...) VALUES ?`, [kayitlar]);
```
`affectedRows` yine toplam olarak döner. `blokOlustur`'a ayrıca toplam kayıt sayısı için üst sınır (ör. 5.000) ve aşılırsa `400` yanıtı eklenmeli.

**Efor:** S

---

### F-19 — Bağlantı havuzu yapılandırılmamış · **Orta**

**Ne:**
```js
// backend/config/db.js:4-10
const pool = mysql.createPool({
  host: ..., user: ..., password: ..., database: ..., port: ...,
});   // connectionLimit, queueLimit, timeout, timezone — hiçbiri yok
```

**Neden önemli:** Varsayılan `connectionLimit` 10'dur ve `queueLimit` 0'dır (sınırsız kuyruk). Bu iki varsayılan birlikte, yük altında **sessiz bir çöküş** demektir: 10 bağlantı doldu mu, sonraki tüm istekler süresiz kuyruğa girer, timeout olmadığı için istemciler asılı kalır, bellek şişer. F-16'daki sızıntıyla birleşince kalıcı kilitlenme.

Ayrıca `timezone` ayarlanmamış — `stok_hareketleri.tarih` yorumlanması Node.js süreç saat diliminie bağlı; `raporController.js:4`'te `new Date().toISOString().slice(0,10)` **UTC** tarihi üretirken MySQL `NOW()` sunucu yerel saatini kullanıyor. Türkiye saatiyle gece 00:00-03:00 arasındaki hareketler günlük raporda **bir önceki güne** düşer. Doğrulanması gereken ama muhtemel bir hata.

`decimalNumbers` ayarlanmadığı için `DECIMAL` kolonlar string olarak dönüyor — kodda yayılan `Number(...)` çağrıları (`stokHareketiController.js:129`, `transferController.js:65`, `satisController.js:133` ...) bunun kanıtı. Şu an doğru yapılıyor ama bir yerde `Number()` unutulursa `"10" + 5 = "105"` tipi sessiz hata olur.

**Düzeltme:**
```js
const pool = mysql.createPool({
  host: ..., /* ... */,
  connectionLimit: Number(process.env.DB_POOL_SIZE) || 20,
  queueLimit: 50,
  waitForConnections: true,
  enableKeepAlive: true,
  timezone: "Z",              // veya "+03:00" — uygulama genelinde tutarlı olmak kaydıyla
  decimalNumbers: true,
});
```
Saat dilimi kararı alındıktan sonra `raporController.tarihAraligi` da buna göre düzeltilmeli.

**Efor:** S

---

### F-20 — Kısmi kullanıcı güncellemesi hata veriyor · **Orta**

**Ne:**
```js
// backend/controllers/kullaniciController.js:19,31-34
const { rol, aktif } = req.body;
...
const [sonuc] = await pool.query(
  "UPDATE kullanicilar SET rol = ?, aktif = ? WHERE id = ?", [rol, aktif, id]);
```

**Neden önemli:** İki ayrı hata:
1. İstemci yalnızca `{ aktif: false }` gönderirse `rol` `undefined` olur ve mysql2 `"Bind parameters must not contain undefined"` fırlatır → F-09 üzerinden kullanıcıya anlamsız bir 500 döner. Yalnızca `{ rol: "admin" }` gönderilirse de `aktif` `undefined` olup aynı sonucu verir.
2. Her iki alan da gönderilse bile, `aktif` hiç doğrulanmıyor — `rol` için `["admin","depo_sorumlusu"]` kontrolü var (satır 27) ama `aktif` için tip kontrolü yok; `"evet"` gibi bir değer MySQL tarafından sessizce `1`'e dönüştürülebilir.

**Ayrıca:** Sistemdeki **son admin** pasife alınabilir veya rolü düşürülebilir. Satır 21'deki kontrol yalnızca kişinin *kendini* değiştirmesini engelliyor; iki admin birbirini düşürebilir ve sistem adminsiz kalır — F-01 düzeltildikten sonra bu, sisteme bir daha admin eklenememesi anlamına gelir (kilitlenme).

**Düzeltme:** Alanları koşullu olarak `SET` listesine ekle (veya `COALESCE(?, rol)` kullan), `aktif`'i `typeof === "boolean"` ile doğrula, ve `UPDATE` öncesinde "bu değişiklikten sonra en az bir aktif admin kalıyor mu" kontrolü ekle.

**Efor:** S

---

### F-21 — Şema ve migration yönetimi yok · **Yüksek**

**Ne:** Repoda hiçbir `.sql` dosyası, migration klasörü veya ORM şema tanımı yok. `backend/package.json` bağımlılıklarında (`bcryptjs`, `cors`, `dotenv`, `express`, `jsonwebtoken`, `mysql2`) migration aracı bulunmuyor.

**Neden önemli:** Bu, denetimin tamamı için en büyük kör nokta ve tek başına yüksek önemli bir operasyonel risk:
- **Yeni bir geliştirici veya yeni bir sunucu projeyi ayağa kaldıramaz.** `npm install && npm start` çalışsa bile veritabanı boştur; tablo yapısını kimse bilmiyor.
- **Şema değişiklikleri elle yapılıyor**, yani dev/prod arasında sessiz farklar oluşuyor ve kimse hangi ortamın hangi durumda olduğunu bilmiyor.
- **Veri bütünlüğü garantilerinin gerçekten var olup olmadığı belirsiz.** Kod, kısıtların varlığını *varsayıyor*: `ER_DUP_ENTRY` yakalamaları (`authController.js:24`, `varyantController.js:119`, `lokasyonController.js:66`) UNIQUE kısıtları ima ediyor, `ON DUPLICATE KEY UPDATE` (`stokHareketiController.js:164`) `varyant_lokasyon(varyant_id, lokasyon_id)` üzerinde bir UNIQUE anahtar **zorunlu** kılıyor. Bu anahtar yoksa her giriş hareketi yeni bir satır yaratır ve stok modeli sessizce bozulur. Doğrulanamadı.
- Bir felaket sonrası **geri yükleme prosedürü yok**; yedek alınıp alınmadığı bile repodan anlaşılamıyor. WMS'te veri kaybı operasyonun durması demektir.

**Düzeltme (öncelik sırasıyla):**
1. **Bugün:** Mevcut veritabanından şemayı dışa aktar ve repoya al — `mysqldump --no-data --routines wms > backend/db/schema.sql`. Bu tek adım, kaybolmuş kurumsal bilgiyi kurtarır.
2. Bir migration aracı benimse (`node-pg-migrate` muadili olarak `umzug`, `db-migrate` veya `knex` migrations). Bundan sonraki her şema değişikliği versiyonlanmış bir dosya olsun.
3. Şemayı dışa aktardıktan sonra **kısıtları denetle** ve eksikleri ekle: tüm `*_id` kolonlarında yabancı anahtarlar, `varyant_lokasyon(varyant_id, lokasyon_id)` UNIQUE, `miktar >= 0` CHECK kısıtları, `stok_hareketleri.tip` ve `.sebep` için ENUM veya CHECK (şu an yalnızca uygulama kodunda — `stokHareketiController.js:3-10,84`), sipariş `durum` alanları için ENUM.
4. Yedekleme: günlük `mysqldump` + binlog ile point-in-time recovery, ve **geri yüklemenin test edildiği** yazılı bir prosedür.

**Efor:** S (adım 1) / M (adım 2-3) / M (adım 4)

---

### F-22 — Test yok · **Yüksek**

**Ne:** `backend/package.json:8` → `"test": "echo \"Error: no test specified\" && exit 1"`. Frontend'de de test yok. Test kütüphanesi bağımlılığı yok.

**Neden önemli:** Bu raporda anlatılan eşzamanlılık hatalarının hiçbiri manuel testle güvenilir şekilde yakalanamaz — çift teslim alma hatası (F-03) yalnızca iki istek milisaniyeler arayla geldiğinde ortaya çıkar. Test edilmemiş kritik yollar:

- **Stok değişmezleri:** Bir dizi giriş/çıkış/transfer/sayım sonrası `SUM(varyant_lokasyon.miktar) == urun_varyantlari.miktar` ve `== stok_hareketleri`'nden hesaplanan bakiye. Bu tek test F-11 sınıfındaki tüm hataları yakalar.
- **Eşzamanlılık:** Aynı siparişe paralel iki `teslim-al`; tam olarak birinin başarılı olması beklenir.
- **Yetkilendirme:** Her uç için "token'sız istek 401 dönmeli" testi — F-02'nin tekrarını kalıcı olarak engeller. Route tablosundan otomatik üretilebilir.
- **Kısmi başarısızlık:** Sipariş oluşturmanın ortasında hata → hiç kayıt kalmamalı (F-05).
- Birim dönüşümü (kg ↔ adet, `Sayim.jsx:96`, `StokHareketleri.jsx:105`) — para ve stok hesabına doğrudan giren mantık, hiç test edilmemiş.

**Düzeltme:** Node.js yerleşik `node:test` (ek bağımlılık gerektirmez) + Docker'da ayağa kalkan bir test MySQL'i. İlk hedef %100 kapsam değil, yukarıdaki beş senaryo. Eşzamanlılık testi için `Promise.all([istek1, istek2])` deseni yeterlidir.

**Efor:** M

---

### F-23 — Servis katmanı yok · **Orta**

**Ne:** Katmanlar: `routes/` → `controllers/` → `mysql2 pool`. Controller'lar aynı anda HTTP ayrıştırması, girdi doğrulaması, iş kuralları, SQL ve transaction yönetimi yapıyor. Veri erişim katmanı hiç yok — ham SQL controller'lara gömülü.

**Neden önemli:** Somut sonuçları bu raporda görünüyor:
- **Aynı iş mantığı birden çok yerde, farklı doğrulukta:** "Stoğu şu lokasyona ekle" mantığı `stokHareketiController.js:161-166`, `transferController.js:81-86` ve `satinalmaController.js:107-112` içinde üç kez ayrı yazılmış. "Stok düş + hareket kaydet" mantığı iki farklı yerde. Bir düzeltme üç yere uygulanmayı gerektiriyor — F-05'in ortaya çıkış nedeni tam olarak bu (satış tarafı düzeltilmiş, satınalma unutulmuş).
- **Transaction boilerplate'i altı yerde tekrarlanmış** ve altısında da aynı `release` hatası var (F-16).
- İş mantığı HTTP'ye bağlı olduğu için test edilemiyor (F-22) ve ileride bir iş kuyruğundan veya CLI'dan çağrılamıyor.

**Düzeltme:** Aşamalı, tek seferde değil:
1. `backend/db/withTransaction.js` — transaction sarmalayıcısı (F-16'yı da çözer).
2. `backend/services/stokServisi.js` — `stokEkle(conn, {varyant_id, lokasyon_id, miktar, sebep, kullanici_id})` ve `stokDus(...)` fonksiyonları. Tüm stok mutasyonları buradan geçsin; negatif stok ve ledger kaydı kontrolü tek yerde.
3. Controller'lar yalnızca: gövdeyi doğrula → servisi çağır → yanıt biçimlendir.

**Efor:** M

---

### F-24 — Token saklama ve oturum yönetimi · **Orta**

**Ne:** JWT `localStorage`'da (`frontend/src/pages/Giris.jsx:39`, `frontend/src/api/axios.js:8`), 8 saat sabit ömürlü (`authController.js:53`), refresh mekanizması yok, sunucu tarafı iptal yok.

**Neden önemli:** `localStorage`'daki token JavaScript'ten okunabilir; herhangi bir XSS açığı doğrudan tam hesap ele geçirmeye dönüşür. Şu an kodda XSS vektörü bulunamadı (`dangerouslySetInnerHTML` yok, React varsayılan kaçışı aktif) — yani bu bir *potansiyel* etki büyütücü, mevcut bir açık değil. Ancak `lucide-react` gibi bağımlılıklardan gelecek bir tedarik zinciri sorunu bu riski gerçeğe çevirir.

Daha somut sorun **8 saatlik sabit ömür + iptal edilemezlik**: F-06'da anlatıldığı gibi çıkarılan bir çalışanın token'ı 8 saat daha geçerli. "Çıkış yap" (`Sidebar.jsx:112-113`) sadece `localStorage`'ı temizliyor — token hâlâ geçerli, kopyalanmışsa kullanılmaya devam eder.

Ayrıca `Sidebar.jsx:102` ve `LokasyonYonetimi.jsx:49` menü ve buton gösterimini `localStorage`'daki `kullanici.rol` üzerinden yapıyor. Kullanıcı bunu elle değiştirip admin menüsünü görebilir — backend `izinVer` kontrolünü yaptığı için **güvenlik açığı değil**, ama kafa karıştırıcı hata mesajlarına yol açar.

**Düzeltme:** Kısa vadede token ömrünü kısalt (ör. 1 saat) ve F-06'nın 2. maddesindeki DB kontrolünü ekle — böylece iptal fiilen mümkün olur. Orta vadede `httpOnly; Secure; SameSite=Strict` cookie + kısa ömürlü access token + refresh token dönüşü. Cookie'ye geçilirse CSRF koruması (SameSite yeterli olur, ek olarak double-submit token) zorunlu hale gelir — şu anki `Authorization` header yaklaşımında CSRF riski yok, bu bilinçli bir denge.

**Efor:** S (kısa vade) / L (tam refresh akışı)

---

### F-25 — Ortam ayrımı yok · **Orta**

**Ne:**
```js
// frontend/src/api/axios.js:4
baseURL: "http://localhost:3000",
```

**Neden önemli:** Frontend production build'i doğrudan çalışmaz — kullanıcının kendi makinesindeki 3000 portuna istek atar. Ayrıca HTTP (HTTPS değil) sabitlenmiş; bu adres bir sunucuya çevrilse bile parolalar ve JWT'ler ağ üzerinde açık gider.

Backend tarafında da `NODE_ENV` ayrımı hiç kullanılmıyor: hata detayı gösterimi (F-09), log seviyesi ve CORS politikası ortamdan bağımsız.

**Düzeltme:** `import.meta.env.VITE_API_URL` kullan, `.env.development` ve `.env.production` dosyaları ekle, `.env.example`'a yaz. Backend'de `NODE_ENV`'e göre hata ayrıntısı ve log formatı ayır.

**Efor:** S

---

### F-26, F-27 — `/test-db` ucu ve env doğrulaması · **Orta**

**F-26:** `backend/index.js:17-24` — `/test-db` ucu kimlik doğrulaması olmadan açık ve başarısızlıkta `err.message` döndürüyor (DB host/port/kullanıcı bilgisi içerebilir). Bir sağlık kontrolü (health check) gerekiyorsa bu, veritabanı hatasını sızdırmayan ayrı bir uç olmalı; teşhis amaçlı bu uç kaldırılmalı veya admin arkasına alınmalı.

**F-27:** `backend/.env.example` `JWT_SECRET` içermiyor (mevcut `backend/.env` içeriyor). Örneği takip eden bir geliştiricinin kurulumunda `process.env.JWT_SECRET` `undefined` olur; `jwt.sign` (`authController.js:52`) bu durumda hata fırlatır — yani sessiz bir güvenlik açığı değil, gürültülü bir çalışma zamanı hatası. Yine de kurulum deneyimini bozuyor. Ayrıca başlangıçta hiçbir env doğrulaması yok: `DB_PASSWORD` boşsa veya `JWT_SECRET` 8 karakterlik zayıf bir değerse uygulama sorunsuz başlar.

**Düzeltme:** `.env.example`'a `JWT_SECRET=` satırını üretme talimatıyla ekle (`openssl rand -base64 48`). `index.js` başında zorunlu env değişkenlerini ve `JWT_SECRET` uzunluğunu (< 32 karakter → başlatma) doğrula — hatalı yapılandırmayla çalışmaktansa açıkça çökmek daha güvenli.

**Efor:** S

---

### F-28 — Bağımlılık güvenlik açıkları · **Orta**

`npm audit` çıktısı (2026-07-31 tarihinde çalıştırıldı):

**Frontend — 2 yüksek:**
```
react-router  7.12.0 - 8.2.0
Severity: high
React Router: RSC Mode CSRF Bypass Allows Action Execution Before 400 Response
https://github.com/advisories/GHSA-qwww-vcr4-c8h2
```
Kurulu sürüm `react-router-dom@^7.18.1` (`frontend/package.json:12`), etkilenen aralıkta. **Değerlendirme:** Bu danışmanlık React Router'ın **RSC (React Server Components) modunu** hedefliyor. Bu proje saf istemci tarafı SPA olarak Vite ile çalışıyor (`App.jsx:29` `BrowserRouter`), RSC veya server action kullanmıyor — dolayısıyla **fiili sömürülebilirlik bu projede düşük**. Yine de sürüm sabitlenmeli. `npm audit fix --force` 7.11.0'a düşürüyor (kırıcı değişiklik uyarısı veriyor); düzeltilmiş bir 8.x sürümüne yükselmek daha doğru olabilir — hangi sürümün yamalı olduğu doğrulanmalı.

**Backend — 1 yüksek:**
```
brace-expansion  <=5.0.7
Severity: high
DoS via unbounded expansion length causing an out-of-memory process crash
https://github.com/advisories/GHSA-mh99-v99m-4gvg
```
**Değerlendirme:** Bu paket `nodemon` üzerinden gelen bir **geliştirme bağımlılığı** (`backend/package.json:22`); production çalışma zamanına (`npm start` → `node index.js`) dahil değil. Etki düşük. `npm audit fix` kırıcı değişiklik olmadan düzeltiyor.

**Terk edilmiş/eski paket:** `bcryptjs` bakımlı ama saf JS implementasyonu olduğu için native `bcrypt`'e göre kat kat yavaş ve event loop'u bloklar (F-07'ye bakınız). Doğrudan bir güvenlik açığı değil, performans/DoS değerlendirmesi.

**Düzeltme:** Backend'de `npm audit fix` çalıştır. Frontend için `react-router-dom`'un yamalı sürümünü belirleyip yükselt. CI'ya `npm audit --audit-level=high` adımı ekle.

**Efor:** S

---

#### Karar — 2026-08-03 · `react-router` için **kabul edilen risk**

Raporun açık bıraktığı "hangi sürüm yamalı" sorusu araştırıldı ve advisory sayfası doğrudan okundu:

| | |
|---|---|
| Advisory | GHSA-qwww-vcr4-c8h2 · High · CVSS 7.1 · CWE-352 (CSRF) |
| Etkilenen aralık | `react-router >= 7.12.0, < 8.3.0` |
| Yamalı sürüm | `8.3.0` |
| Kurulu sürüm | `react-router-dom@7.18.1` → `react-router@7.18.1` |

**Advisory'nin kendi notu:** *"This only affects your application if you are using the unstable RSC APIs."*

Bu proje `BrowserRouter` ile saf istemci tarafı SPA olarak çalışıyor; RSC API'leri, server action'lar veya `unstable_` önekli hiçbir arayüz kullanılmıyor. **Savunmasız kod yolu bu uygulamada hiç çalıştırılmıyor.**

Düzeltme seçenekleri ve neden reddedildikleri:

1. **`npm audit fix --force`** — `react-router-dom`'u `7.11.0`'a *düşürür* (7 sürüm geriye, kırıcı değişiklik). Sömürülemeyen bir açık için çalışan bir uygulamayı geriletmek net zarar.
2. **`react-router-dom@7.18.2`** — npm'deki en güncel sürüm, ama hâlâ etkilenen aralıkta. Açığı kapatmaz.
3. **`react-router@8.3.0`** — açığı gerçekten kapatan tek seçenek. Ancak v8'de `react-router-dom` paketi kaldırılmış (npm'de 7.18.2'de donmuş durumda); geçiş, tüm yönlendirme import'larının elle değiştirilmesini gerektiren major sürüm göçü.

**Karar:** Risk kabul edildi. Şu an sürüm yükseltilmiyor.

**Gerekçe:** Sömürülebilirlik sıfıra yakın (savunmasız kod yolu hiç çağrılmıyor), düzeltme maliyeti major sürüm göçü, ve bu bir iç ağda çalışan depo uygulaması.

**Yeniden değerlendirme koşulları** — aşağıdakilerden biri olursa bu karar geçersizdir:

- Projede RSC veya server action kullanılmaya başlanırsa
- Uygulama internete açık bir adrese deploy edilirse
- `react-router` için RSC dışı kod yollarını da etkileyen yeni bir advisory çıkarsa

**Genel ders:** `npm audit` bağımlılık ağacındaki *sürüm numaralarına* bakar, o kodun *kullanılıp kullanılmadığına* bakmaz. Yüksek skoru görüp refleksle `--force` çalıştırmak, çalışan bir projeyi kırmanın en hızlı yoludur. Doğru sıra: advisory'i aç → "Affected versions" ve açıklama notunu oku → kendi kod tabanınla eşleşiyor mu bak → ancak ondan sonra karar ver.

> **Backend notu:** Raporda geçen `brace-expansion` bulgusu, bağımlılıklar güncel sürümlere çözüldüğünde görünmüyor (`npm audit` → 0 açık). Bu paket zaten `nodemon` üzerinden gelen bir geliştirme bağımlılığıydı, production çalışma zamanına dahil değil. `backend/` içinde `npm audit fix` çalıştırılıp lock dosyası tazelenerek kapatılmalı.

---

### F-29 — Girdi doğrulama şeması yok · **Orta**

**Ne:** Doğrulama tamamen elle ve tutarsız. Örnekler:
- `sayimController.js:24` — `kalemler` bir dizi mi kontrol edilmiyor; `{ kalemler: "abc" }` gönderilirse `.length` `3` döner ve `for...of` string karakterlerini döner → anlamsız hata.
- `satisController.js:48-51` — `toplam_tutar` istemciden gelen `birim_fiyat` ile hesaplanıyor; fiyat hiç doğrulanmıyor (negatif olabilir) ve ürünün gerçek fiyatıyla karşılaştırılmıyor. `NaN` gelirse toplam `NaN` olur ve DB'ye yazılmaya çalışılır.
- `lokasyonController.js:44` — `!satir` kontrolü `satir = 0` değerini de reddeder (`0` falsy'dir); muhtemelen istenmeyen davranış.
- `varyantController.js:111` — `miktar || 0` ile doğrudan başlangıç stoğu kabul ediliyor, hiçbir `stok_hareketleri` kaydı üretmeden (F-11'deki drift kaynağı).
- `stokHareketiController.js:82` — `req.body`'den alanlar destructure ediliyor; fazladan alan gönderilse yok sayılıyor (mass assignment riski burada yok, çünkü her yerde açık destructuring kullanılmış — bu **olumlu** bir nokta).

**Düzeltme:** `zod` veya `joi` ile uç başına şema tanımla ve bir `dogrulaGovde(sema)` middleware'i ile uygula. Bu ayrıca F-20'yi çözer ve F-09'daki 500'lerin çoğunu anlamlı 400'lere dönüştürür. `toplam_tutar` **sunucuda** varyantın kayıtlı fiyatından hesaplanmalı, istemciden gelen fiyata güvenilmemeli.

**Efor:** M

---

### F-30 — Gözlemlenebilirlik ve operasyon · **Orta**

**Ne:** `backend/index.js`'te yok: gerçek health check (readiness/liveness), graceful shutdown (SIGTERM'de mevcut isteklerin bitmesini bekleme, havuzu kapatma), yapılandırılmış log, istek log'u, `requestId` korelasyonu, metrik, hata takibi (Sentry vb.). Tek loglama `console.error(err)` (`hataYonetici.js:2`).

**Neden önemli:** Bu raporda anlatılan sessiz veri bütünlüğü hataları (F-03, F-05, F-11) **ancak loglarla veya metriklerle** yakalanabilir. Şu anki kurulumda bir çift teslim alma olayı gerçekleştiğinde hiçbir iz kalmıyor. Graceful shutdown olmaması ise deploy sırasında transaction ortasındaki isteklerin kesilmesi demek — F-16'daki sızıntı senaryosunun tetikleyicisi.

**Olumlu not:** `stok_hareketleri` tablosu `olusturan_kullanici_id` ve `tarih` tutuyor ve **tüm** stok mutasyon yolları bunu dolduruyor (`stokHareketiController.js:152`, `satisController.js:182`, `satinalmaController.js:124`, `sayimController.js:67`) — stok için denetim izi gerçekten var ve bu iyi tasarlanmış. Eksik olan: fiyat değişiklikleri, kullanıcı rol değişiklikleri, lokasyon silme ve giriş denemeleri için denetim kaydı yok.

**Düzeltme:** `pino` ile JSON log + `requestId`, `GET /saglik` (DB ping dahil ama hata detayı sızdırmadan), `process.on("SIGTERM")` ile `server.close()` + `pool.end()`. Kritik iş olayları (teslim alma, teslim etme, sayım farkı, tutarsızlık tespiti) için ayrı bir `is_olaylari` log seviyesi.

**Efor:** M

---

### F-31 — Frontend kod kalitesi notları · **Düşük**

- **Yutulan hatalar:** `StokHareketleri.jsx:95` → `.catch(() => setVaryantLokasyonlari([]))`. Lokasyon listesi çekilemediğinde kullanıcı "bu varyantın hiç stoğu yok" sanır. Ağ hatası ile boş sonuç ayırt edilmiyor.
- **Tek dosyada 1850 satır CSS:** `frontend/src/index.css`. Bileşen bazlı bölme veya CSS modülleri sürdürülebilirliği artırır.
- **Büyük bileşenler:** `LokasyonYonetimi.jsx` (541 satır), `Varyantlar.jsx` (528), `SatisSiparisleri.jsx` (472), `SatinalmaSiparisleri.jsx` (427). Her biri veri çekme + form durumu + tablo + modal mantığını bir arada tutuyor; custom hook'lara (`useLokasyonlar`, `useSiparisler`) ayrılabilir.
- **Sanallaştırma yok:** Büyük listeler (stok hareketleri, varyantlar, lokasyonlar) DOM'a tamamen basılıyor. `react-window` ile kolayca çözülür — ama önce F-17'deki sunucu tarafı sayfalama yapılmalı, sanallaştırma bunun yerine geçmez.
- **Kod bölme yok:** `App.jsx:3-19` tüm sayfaları statik olarak import ediyor. `React.lazy` + `Suspense` ile rota bazlı bölme ilk yükleme süresini belirgin düşürür.
- **Tip güvenliği yok:** TypeScript kullanılmıyor (`@types/react` kurulu ama sadece editör desteği için). Maliyeti somut: `satisController.js:48`'deki `k.miktar * k.birim_fiyat` çarpımında istemciden gelen string/undefined değerler derleme zamanında yakalanamıyor; API yanıt şekilleri ile frontend beklentileri arasında hiçbir sözleşme yok. Bu boyuttaki bir projede TS'e geçiş M-L efor, ama backend'de `zod` (F-29) ile şemadan tip türetmek benzer faydanın önemli bir kısmını daha ucuza verir.

**Efor:** S (yutulan hatalar, kod bölme) / M (bileşen ayrıştırma) / L (TypeScript)

---

## 4. Yol Haritası

### 4.1 Etki × Efor matrisi

| | **Düşük efor (S)** | **Orta efor (M)** | **Yüksek efor (L)** |
|---|---|---|---|
| **Yüksek etki** | **F-01** açık kayıt<br>**F-02** auth eksikliği<br>**F-03/F-04** çift teslim<br>**F-05** transaction<br>**F-06** pasif kullanıcı<br>**F-08** CORS<br>**F-21.1** şema dışa aktarma | **F-11.2** tek stok kaynağı<br>**F-12** deadlock<br>**F-22** kritik yol testleri<br>**F-17** sayfalama<br>**F-21.2** migration altyapısı | **F-13** rezervasyon<br>**F-11.3** ledger mimarisi |
| **Orta etki** | **F-07** rate limit<br>**F-09** hata sızıntısı<br>**F-10** helmet<br>**F-14** iptal yarışı<br>**F-16** bağlantı sızıntısı<br>**F-18** toplu insert<br>**F-19** havuz ayarı<br>**F-20** kullanıcı güncelleme<br>**F-25** ortam ayrımı<br>**F-26/27** env & test-db<br>**F-28** bağımlılıklar | **F-15** idempotanlık<br>**F-23** servis katmanı<br>**F-29** şema doğrulama<br>**F-30** gözlemlenebilirlik<br>**F-21.4** yedekleme | **F-24** refresh token akışı |
| **Düşük etki** | **F-31** yutulan hata, kod bölme | **F-31** bileşen ayrıştırma | **F-31** TypeScript |

### 4.2 Önerilen sıra

**Faz 0 — Acil (1-2 gün):** F-01, F-02, F-06, F-03, F-04, F-05, F-08. Yedisi de S efor, ikisi tek satır. Bunlar yapılmadan sistem hiçbir ağa açılmamalı.

**Faz 1 — Temel sağlamlaştırma (1 hafta):** F-21.1 (şemayı repoya al — bunu ilk gün yap, en ucuz sigorta), F-16, F-19, F-14, F-20, F-09, F-07, F-10, F-25, F-26/27, F-28. Hepsi S efor, birikimli etkisi büyük.

**Faz 2 — Veri bütünlüğü (2-3 hafta):** F-22 (önce testler — sonraki değişikliklerin güvenlik ağı), F-11.2 (tek stok kaynağı), F-12, F-15, F-23, F-17. Sıralama önemli: testler olmadan F-11.2'ye girmek riskli.

**Faz 3 — Olgunlaşma (1-2 ay):** F-13 (rezervasyon), F-21.2-4 (migration + kısıtlar + yedekleme), F-29, F-30, F-24.

---

## 5. Yeni Yetenekler — "Daha neler yapılabilir"

Aşağıdakiler kodda **olmayan** ve bu projenin mevcut olgunluk seviyesine özel olarak seçilmiş önerilerdir. Sırasız değil — her biri için "neden şimdi" gerekçesi mevcut koddaki somut bir boşluğa dayanıyor.

### 5.1 Parti/lot takibi ve son kullanma tarihi + FEFO · Efor **L** · Bağımlılık: F-11.2

**Neden şimdi:** `varyantController.js:88-95`'teki alan setine bakılırsa (`boy`, `ambalaj_tipi`, `ambalaj_kg`, kalibre kavramı) bu depo **gıda veya tarım ürünü** işliyor. Bu ürün sınıfında lot ve son kullanma tarihi takibi çoğu zaman yasal zorunluluktur (geri çağırma/izlenebilirlik), operasyonel olarak da FEFO (First Expired, First Out) olmadan fire kaçınılmazdır. Şu anki tahsis mantığı (`satisController.js:127` → `ORDER BY vl.miktar DESC`) **en dolu lokasyondan** alıyor — bu ne FIFO ne FEFO, tamamen keyfi bir sıra ve raf ömrü açısından en kötü stratejilerden biri.

`varyant_lokasyon` tablosuna `parti_no` ve `son_kullanma_tarihi` ekleyip birincil anahtarı `(varyant_id, lokasyon_id, parti_no)` yapmak doğal yol. Tahsis sıralaması `ORDER BY son_kullanma_tarihi ASC` olur. Bunun F-11.2'den (tek stok kaynağı) sonra yapılması şart — aksi halde `urun_varyantlari.miktar` ile parti bazlı toplamları senkronize tutmak imkânsız hale gelir.

### 5.2 Döngüsel sayım (cycle counting) · Efor **M** · Bağımlılık: yok

**Neden şimdi:** `sayimController` ve `Sayim.jsx` zaten var ve lokasyon bazında çalışıyor — altyapının %70'i hazır. Eksik olan planlama katmanı: hangi lokasyonun ne zaman sayılacağı, sayım görevlerinin atanması, sayım geçmişi ve doğruluk oranı (accuracy) metriği. ABC sınıflandırmasıyla birleştirilirse (hareket sıklığına göre A/B/C, A grubu ayda bir, C yılda bir) yıllık toplu sayım için depoyu kapatma ihtiyacı ortadan kalkar.

Ek olarak: `lokasyonController.tutarlilik` ucundaki fark tespiti bir sayım görevi tetikleyicisine bağlanabilir — sistem kendi tutarsızlığını fark edip sayım emri açar. Bu, F-11'deki drift sorununun operasyonel çözümü.

### 5.3 Barkod / RF terminal desteği · Efor **M** · Bağımlılık: F-15 (idempotanlık)

**Neden şimdi:** `urun_varyantlari.barkod` alanı zaten var (`varyantController.js:91`) ve arama filtresine dahil (`varyantController.js:22`), `Etiket.jsx` bileşeni mevcut — ama hiçbir yerde barkod **okuma** akışı yok. Depo personeli hâlâ açılır listelerden varyant seçiyor (`Sayim.jsx:201`, `StokHareketleri.jsx`), bu hem yavaş hem hata kaynağı.

En düşük maliyetli yol: USB/Bluetooth barkod okuyucular klavye olarak davranır — bir "barkod odaklı" giriş alanı ve `Enter` ile tetiklenen arama, hiçbir donanım entegrasyonu gerektirmeden kazanç sağlar. Lokasyon barkodları da eklenirse ("önce rafı okut, sonra ürünü") yanlış lokasyona işlem yapma hatası büyük ölçüde ortadan kalkar.

**İdempotanlık ön koşul:** Barkod okuyucular tek okutmada iki kez sinyal gönderebilir; F-15 çözülmeden bu özellik doğrudan çift stok hareketi üretir.

### 5.4 Toplama listesi (pick list) ve dalga toplama · Efor **L** · Bağımlılık: F-13

**Neden şimdi:** `satisController.teslimEt` şu an tahsis planını hesaplıyor (`tahsisPlani`, satır 119-159) ama bunu **hiç göstermiyor** — sadece stok düşüp yanıt dönüyor. Yani sistem "hangi raftan ne alınacağını" biliyor ama depo personeline söylemiyor. Bu, mevcut kodun en yakın meyvesi: `tahsisPlani`'nı kalıcılaştırıp yazdırılabilir bir toplama listesine dönüştürmek, tahsis ile fiziksel toplamayı ayırmak demek.

Devamında: birden çok siparişi tek turda toplama (dalga/batch picking), toplama rotasının lokasyon koordinatlarına göre optimize edilmesi. Koordinat verisi zaten mevcut — `lokasyonlar` tablosunda `satir`, `kolon`, `blok`, `sira`, `derinlik`, `kat` alanları var (`lokasyonController.js:236-247`) ve `DepoHaritası.jsx` bunları görselleştiriyor. Yani rota optimizasyonu için gereken veri modeli **hazır**, kullanılmıyor.

### 5.5 Yeniden sipariş noktası ve otomatik satınalma önerisi · Efor **S** · Bağımlılık: yok

**Neden şimdi:** `kritik_seviye` alanı ve `dusukStok` ucu (`varyantController.js:69-82`) zaten var ama pasif — sadece bir liste gösteriyor. Bunu bir aksiyona bağlamak çok düşük maliyetli: kritik seviyenin altına düşen varyantlar için, geçmiş tüketim hızı (`stok_hareketleri`'nden hesaplanabilir) ve tedarikçi teslim süresi kullanılarak önerilen sipariş miktarı hesaplanır ve tek tıkla taslak satınalma siparişi oluşturulur. Satınalma sipariş altyapısı hazır olduğu için bu, birkaç günlük bir iş.

Ön koşul: F-13'teki rezervasyon olmadan "kullanılabilir stok" yanlış hesaplanır, yani öneriler bir miktar yanıltıcı olur — ama yine de mevcut durumdan iyidir.

### 5.6 Çok depolu yapı · Efor **L** · Bağımlılık: F-02, F-13

**Neden şimdi:** Şu an tek depo varsayımı **her yere gömülü** — `lokasyonlar` tablosunda depo referansı yok, hiçbir sorguda depo filtresi yok, `dogrula` middleware'i kullanıcıyı bir depoya bağlamıyor. Bu, ürün ikinci bir depoya açılmak istendiğinde neredeyse tüm sorguların dokunulmasını gerektirecek bir borç.

Kritik nokta: **şimdi eklemek ucuz, sonra pahalı.** `lokasyonlar.depo_id` kolonu + `kullanicilar.depo_id` + her sorguda depo filtresi bugün S-M efor; 50 controller ve binlerce satır sorgu sonrasında L-XL olur. Ayrıca bu, F-02'de anlatılan yetkilendirme boşluğunun IDOR/BOLA boyutunu da kapatır — şu an "başka bir deponun verisi" kavramı olmadığı için yatay yetki yükseltme test edilemiyor bile.

### 5.7 Çevrimdışı öncelikli (offline-first) mobil toplama arayüzü · Efor **L** · Bağımlılık: F-15

**Neden şimdi:** Depoların önemli bir kısmında (özellikle soğuk hava depoları ve yüksek raflı alanlar) Wi-Fi kapsama boşlukları vardır. Mevcut frontend her işlem için ağ bağlantısı gerektiriyor ve bağlantı koptuğunda (`axios.js:17-27`) yalnızca 401 durumunu ele alıyor — ağ hatasında kullanıcı işlemi kaybediyor.

Bu, listedeki en iddialı öneri ve **F-15 (idempotanlık) kesinlikle önce çözülmeli**: çevrimdışı kuyruk, bağlantı geri geldiğinde biriken işlemleri gönderir ve tekrar gönderim garantisi ancak idempotanlık anahtarıyla güvenli olur. Aksi halde bu özellik doğrudan stok bozulması üretir.

### 5.8 Diğer, daha küçük fırsatlar

| Öneri | Efor | Neden şimdi |
|---|---|---|
| **Etiket yazdırma (ZPL)** | S | `Etiket.jsx` ve `Fis.jsx` zaten var ama tarayıcı yazdırmasına dayanıyor; termal yazıcılar için ZPL çıktısı depo pratiğine çok daha uygun |
| **Slotting (konum optimizasyonu) raporu** | M | Hareket sıklığı verisi `stok_hareketleri`'nde mevcut; hızlı hareket eden ürünlerin sevkiyat kapısına yakın raflara taşınması önerisi üretilebilir |
| **İş kuyruğu (BullMQ vb.)** | M | Şu an rapor üretimi ve `blokOlustur` gibi uzun işlemler HTTP isteğini bloklar; kuyruk bunları arka plana taşır ve F-18'deki timeout riskini kaldırır |
| **ERP / e-ticaret entegrasyonu** | L | Sipariş modeli hazır; ancak F-15 (idempotanlık) ve F-13 (rezervasyon) olmadan dış sistemden gelen sipariş akışı veri bütünlüğünü bozar — bu ikisinden sonra sıraya alınmalı |
| **Kargo firması API'leri** | M | Satış teslim akışına doğal olarak takılır; öncesinde sevkiyat/paket kavramının modellenmesi gerekir (şu an yok) |
| **Çapraz sevkiyat (cross-docking)** | M | `satinalmaController.teslimAl` tek lokasyona indiriyor; bekleyen satış siparişleriyle eşleştirip doğrudan sevkiyat alanına yönlendirme mantığı eklenebilir — F-13'ten sonra |

---

## 6. Doğrulanamayanlar

Aşağıdaki maddeler **statik inceleme ile kesinleştirilemedi**. Bunlar bulgu değil, doğrulama görevleridir.

1. **Veritabanı şemasının tamamı.** Repoda DDL yok. Tablo yapıları, kolon tipleri ve boyutları, `NULL` izinleri hiç doğrulanamadı. → `SHOW CREATE TABLE` çıktısı ile kontrol edilmeli.

2. **Yabancı anahtarların gerçekten var olup olmadığı.** Kod, `satis_siparis_kalemleri.siparis_id` → `satis_siparisleri.id` gibi ilişkileri varsayıyor ama FK yoksa hiçbir şey yetim kayıt oluşmasını engellemiyor. → `SELECT * FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='wms'`

3. **`varyant_lokasyon(varyant_id, lokasyon_id)` üzerinde UNIQUE anahtar var mı.** Bu **kritik**: `ON DUPLICATE KEY UPDATE` (`stokHareketiController.js:164`, `transferController.js:84`, `sayimController.js:74`, `satinalmaController.js:110`) bu anahtar olmadan çalışmaz — her giriş yeni satır yaratır ve stok modeli sessizce bozulur. Sistem şu an düzgün çalışıyorsa anahtar muhtemelen vardır, ama teyit edilmeli.

4. **`miktar` kolonlarında `CHECK (miktar >= 0)` kısıtı var mı.** Negatif stok senaryolarının (F-04, F-11) gerçekten mümkün olup olmadığı buna bağlı. MySQL 8.0.16 öncesi sürümlerde `CHECK` yok sayılır — **MySQL sürümü de doğrulanmalı**.

5. **İndekslerin varlığı.** F-17'deki performans değerlendirmesi indekssiz varsayıma dayanıyor; gerçek durum farklı olabilir. → `SHOW INDEX FROM <tablo>` her tablo için.

6. **Eşzamanlılık hatalarının fiili olarak tetiklenebilirliği.** F-03, F-04, F-12 ve F-14 kod okumasıyla tespit edildi; gerçek MySQL izolasyon davranışı altında **çalıştırılarak** doğrulanmalı. Önerilen test: aynı sipariş id'sine `Promise.all` ile iki paralel `PATCH .../teslim-al` isteği; beklenen sonuç bir başarı + bir hata, gözlenen sonuç muhtemelen iki başarı.

7. **MySQL izolasyon seviyesi.** Varsayılan `REPEATABLE READ` varsayıldı. `READ COMMITTED` kullanılıyorsa bazı yarış pencereleri değişir (analiz sonuçları büyük ölçüde aynı kalır, çünkü sorunlu okumalar zaten transaction *dışında*). → `SELECT @@transaction_isolation;`

8. **Saat dilimi tutarsızlığı (F-19).** `raporController.js:4`'teki UTC tarih üretimi ile MySQL `NOW()` arasındaki olası uyumsuzluk, sunucunun ve MySQL'in gerçek `time_zone` ayarına bağlı. → `SELECT @@global.time_zone, @@session.time_zone, NOW(), UTC_TIMESTAMP();` ve Node.js tarafında `process.env.TZ`. Bir gece yarısı işlemi yaratıp günlük raporda hangi güne düştüğüne bakmak en kesin test.

9. **`react-router` danışmanlığının bu projeye etkisi.** RSC modu kullanılmadığı için etkisiz değerlendirildi (F-28), ancak danışmanlığın tam kapsamı okunup teyit edilmeli. Ayrıca 8.2.0 üstü hangi sürümün yamalı olduğu belirlenmeli.

10. **Production dağıtım yapılandırması.** Reverse proxy (nginx vb.), TLS sonlandırma, `trust proxy` ayarı, süreç yöneticisi (pm2/systemd), yedekleme cron'u — hiçbiri repoda yok. Sunucu üzerinde var olabilirler; varsa yapılandırma repoya alınmalı, yoksa F-30'a eklenmeli.

11. **Frontend bundle boyutu.** `npm run build` çalıştırılmadı. Kod bölme yokluğunun (F-31) gerçek maliyeti ölçülmedi.

12. **`sayimController` içinde `kalemler` dizisinde aynı `varyant_id`'nin iki kez gönderilmesi.** Kod bunu engellemiyor (`sayimController.js:24`); ikinci kayıt birinciyi ezer ve `urun_varyantlari.miktar` iki kez düzeltilir → drift. Arayüz (`Sayim.jsx:100`) tekrarı üretmiyor gibi görünüyor ama API doğrudan çağrılabilir. Elle test gerekli.

---

## 7. Bugün yapılacak üç şey

Bugün üç şey yapılacaksa: **birincisi**, `POST /auth/kayit` ucundan `rol` alanını kaldırıp ucu kapatmak ve `routes/index.js`'te `/auth` dışındaki tüm router'ları global `dogrula` arkasına almak — bu iki dosyada toplam beş satırlık değişiklik, sistemin "yetkilendirmesi var" ile "yetkilendirmesi gerçekten çalışıyor" arasındaki farkı kapatıyor ve müşteri kişisel verilerinin anonim erişime açık olmasını sonlandırıyor. **İkincisi**, `satinalmaController.teslimAl` ve `satisController.teslimEt` içindeki sipariş `SELECT`'lerini `beginTransaction()` sonrasına taşıyıp `FOR UPDATE` eklemek — yine birkaç satır, ama bugünden itibaren her çift tıklamanın veya ağ retry'ının sessizce stok bozmasını engelliyor; bu hatanın maliyeti zamanla birikiyor ve geriye dönük düzeltilmesi neredeyse imkânsız. **Üçüncüsü**, `mysqldump --no-data --routines` ile mevcut şemayı repoya almak — çünkü şu anda bu sistemin veri modeli yalnızca çalışan bir MySQL sunucusunun içinde yaşıyor; o sunucu kaybolursa proje kurtarılamaz ve bu, listedeki en ucuz ama en yüksek getirili sigorta.

> **4 Ağustos notu:** Bu üç maddenin üçü de yapıldı.

---

## 8. Bundan sonra ne yapılabilir

31 Temmuz raporundaki bulguların çoğu kapandı ve palet modeliyle sistem gerçek bir WMS'e yaklaştı. Bundan sonrası için sıra önerisi aşağıda. Sıralama önem × maliyet dengesine göre; yukarıdan aşağı gitmek mantıklı.

### 8.1 Teslimden önce — küçük ama eksikliği göze batar

**README yazılması.** Repoda hiç yok. Kurulum adımları, ortam değişkenleri, veritabanı kurulumu, `npm run dev`. Projeyi ilk kez açan biri şu an nereden başlayacağını bilemez. Yarım saatlik iş, teslimde ilk bakılan yer.

**Graceful shutdown.** `SIGTERM` alındığında yeni istek kabul etmeyi bırakıp açık işlemlerin bitmesini beklemek ve havuzu kapatmak. Şu an süreç öldürüldüğünde yarım kalan bir transaction varsa MySQL zaman aşımına bırakılıyor. Yirmi satır.

**Kalan listelerin sayfalanması (F-17).** Müşteriler, tedarikçiler, satış ve satınalma siparişleri hâlâ tek seferde çekiliyor. Sayfalama kalıbı projede zaten dört yerde var, kopyalanacak.

**"Hazırlanıyor" durumu.** `satis_siparisleri.durum` enum'unda var ama hiçbir kod yazmıyor. Sipariş satırına elle "Hazırlamaya Başla" / "Geri Al" butonu koymak, hangi siparişin toplanmakta olduğunu görünür kılar. Otomatik kilit yapılmamalı — bırakma yolu olmayan kilit takılı sipariş üretir.

### 8.2 Sistemi sağlamlaştıran — orta vade

**Test altyapısı (F-22).** Raporun en büyük açık maddesi ve bugün eklenen her şey elle doğrulandı. Node'un yerleşik test runner'ı + `supertest` yeterli. İlk yazılacak test şu olmalı:

> Bir dizi giriş / çıkış / transfer / paletleme / satış / sayım işleminden sonra
> `SUM(stok_birimleri.miktar) == urun_varyantlari.miktar`

Bu tek değişmez testi, bugün elle kovaladığımız sapma sınıfının tamamını yakalar. Palet modeline geçerken beş ayrı denetleyicide miktar düşme mantığı değişti; her seferinde Sistem Sağlığı ekranını elle yenileyip sapmaya baktık. Bu testle o kontrol otomatikleşir.

**`urun_varyantlari.miktar`'ın kaldırılması (F-11'in kalanı).** Dağılım artık tek kaynakta ama toplam hâlâ ayrı bir kolonda tutuluyor ve her işlemde ayrıca güncelleniyor. Kaldırılıp `SUM(stok_birimleri.miktar)` ile hesaplanırsa sapma matematiksel olarak imkânsız hale gelir. Bedeli: `listele`, `dusukStok` ve panel sorgularının `GROUP BY`'a geçmesi ve `stok_birimleri(varyant_id)` indeksinin önem kazanması. Test altyapısı kurulduktan **sonra** yapılmalı.

**Rezervasyon / tahsis (F-13).** Sipariş oluşturmak stoğu hâlâ bloke etmiyor; aynı 100 kova üç ayrı siparişe satılabiliyor, sorun teslim anında çıkıyor. `stok_birimleri`'ne `rezerve_miktar` kolonu ya da ayrı bir `stok_rezervasyonlari` tablosu. Palet modeli bunu kolaylaştırdı — rezervasyon artık birim düzeyinde yapılabilir.

**Şema tabanlı girdi doğrulama (F-29).** Her denetleyicide elle yazılan `Number.isFinite` / `typeof` kontrolleri yerine `zod` benzeri bir katman. Doğrulama kodu yarıya iner ve hata mesajları tutarlı hale gelir.

**Versiyonlanmış migration (F-21'in kalanı).** `schema.sql` bir anlık görüntü, değişiklik geçmişi tutmuyor. Bu hafta içinde altı `ALTER TABLE` elle çalıştırıldı ve hiçbiri repoda kayıtlı değil. `db/migrations/001_....sql` gibi sıralı dosyalar ve hangi migration'ın uygulandığını tutan bir tablo yeterli.

**Token saklama (F-24'ün kalanı).** Şifre değişince oturum sonlandırma eklendi ama token hâlâ `localStorage`'da, yani XSS ile okunabilir. `httpOnly` cookie'ye geçiş doğru adım; CSRF koruması gerektirir.

### 8.3 Ürün yetenekleri — uzun vade

**Palet etiketi basma.** Palet kodu üretiliyor ama etiket basılmıyor. Yazdırılabilir bir barkod etiketi (Code128 ya da QR) `Fis` bileşenindeki yazdırma kalıbıyla aynı mantıkta yapılabilir. Barkod okuyucu geldiğinde döngü tamamlanır: etiket bas → yapıştır → okut → bul.

**Parti / lot takibi ve FEFO.** Zeytinde raf ömrü var; şu an hangi partinin ne zaman geldiği kaydedilmiyor. `stok_birimleri`'ne `parti_no` ve `son_kullanma_tarihi` eklemek doğal yol — palet zaten fiziksel bir birim olduğu için parti bilgisi tam oraya oturuyor. Tahsis sırası `ORDER BY son_kullanma_tarihi` olur. **Bu, palet modeline geçilmiş olması sayesinde artık ucuz bir iş.**

**Toplama listesi (pick list).** Toplama ekranı birim seçtiriyor ama yazdırılabilir bir liste üretmiyor. Lokasyon koordinatları (`satir`, `kolon`, `blok`, `sira`) zaten var; toplama sırası depo içinde yürüme mesafesine göre sıralanabilir.

**Excel dışa aktarma.** Stok listesi, hareket dökümü, sayım sonucu. Muhasebeye veri aktarımı için pratikte en çok istenen şey.

**Kategori ayrımı.** "Yeşil Zeytin" / "Siyah Zeytin" ayrımı hâlâ yapılmadı — kod işi değil, veri işi.

**Döngüsel sayım (cycle counting).** Tüm depoyu yılda bir kez saymak yerine her gün birkaç lokasyon saymak. Sayım altyapısı hazır; eksik olan sadece "bugün hangi lokasyonlar sayılacak" listesini üreten mantık.

**Çok depolu yapı.** Şu an tek depo varsayılıyor. İkinci bir depo açılırsa `lokasyonlar`'a `depo_id` eklenmesi ve tüm sorgulara depo filtresi girmesi gerekir. Erken yapılırsa maliyeti düşük, geç kalınırsa her sorguya dokunmak gerekir.

### 8.4 Bilinçli olarak yapılmayanlar

Bunlar unutulmuş değil, tartışılıp ertelenmiş kararlar:

- **`react-router` sürüm yükseltmesi** — sömürülemeyen bir açık için major göç maliyetine değmez (bkz. F-28 kararı). İptal koşulları orada yazılı.
- **Otomatik tahsis kuralı (FIFO / en büyükten)** — teslimde hangi birimden çıkılacağına sistem değil kullanıcı karar veriyor. Müşteriye göre değişen bir tercih olduğu için bilinçli seçim.
- **Mal kabulde palet oluşturma** — gelen mal dökme iniyor, paletleme ayrı adım. Gerçek akışa daha yakın: mal önce yere iner, sonra istiflenir.
- **Docker** — tek makinede geliştirilen, tek veritabanı kullanan bir projede fayda değil sürtünme getiriyor. Deploy aşamasında yeniden değerlendirilecek.
