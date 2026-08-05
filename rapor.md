# WMS Projesi — İkinci Teknik Denetim Raporu

**Tarih:** 2026-08-04
**Kapsam:** `backend/` (Express 5 + MySQL2) ve `frontend/` (React 19 + Vite 8), commit `6988d25` üzerindeki çalışma ağacı
**Referans:** `AUDIT.md` (2026-07-31 tarihli ilk denetim + 4 Ağustos durum tablosu)

**Yöntem:**

- `AUDIT.md` baştan sona okundu, F-01 – F-31 arasındaki 31 bulgunun tamamı tek tek mevcut kodla karşılaştırıldı.
- Backend'deki 18 controller, 19 route dosyası, 4 middleware, 2 config, 2 util ve `db/schema.sql` satır satır okundu.
- Frontend'deki 18 sayfa, 8 bileşen, 20 API modülü, context, `App.jsx`, `main.jsx`, `index.html` ve 1850 satırlık `index.css` okundu.
- Ölçüm yapılan komutlar: `npx eslint .`, `npm run build`, `npm audit` (her iki tarafta).
- Uygulama **çalıştırılmadı**, veritabanına bağlanılmadı. Şemaya dair ifadeler `backend/db/schema.sql` üzerinden **doğrulandı** (ilk raporun en büyük kör noktası artık kapalı).
- **Hiçbir dosya değiştirilmedi.** Ölçüm için üretilen `frontend/dist/` çıktısı silindi, çalışma ağacı denetim öncesiyle birebir aynı bırakıldı (`git status` temiz).

**Özet hüküm:** İlk rapordaki kritik ve yüksek önemli güvenlik/eşzamanlılık bulgularının tamamı gerçekten kapatılmış. Kapatma işi yüzeysel değil — `FOR UPDATE`, koşullu `UPDATE`, `try/finally`, `token_surumu`, deterministik kilit sırası gibi doğru refleksler kodda görünüyor. Buna karşılık **iki yapısal sorun devam ediyor**: (1) `urun_varyantlari.miktar` hâlâ ayrı bir toplam olarak tutuluyor ve onu bozan yol hâlâ arayüzde açık, (2) frontend, backend'in ulaştığı olgunluğa yetişememiş — 48 lint hatası, 788 kB tek parça bundle, sıfır ARIA, sıfır test. Ayrıca ilk raporda hiç geçmeyen **yeni bir kritik eşzamanlılık bulgusu** tespit edildi: tablolar arası kilit sırası tutarsız (Y-01).

---

## 1. ÇÖZÜLMÜŞ OLANLAR ✅

Bu bölümde `AUDIT.md` durum tablosunda "kapandı" denen maddeler koda karşı **tek tek doğrulandı**. Bir madde burada listeleniyorsa, iddia edilen düzeltmenin kodda gerçekten var olduğu görüldü demektir.

### F-01 — Açık kayıt ucu → yetki yükseltme · **Gerçekten kapandı**

**Eski problem:** `POST /auth/kayit` hiçbir middleware olmadan açıktı ve `rol` alanını istek gövdesinden kabul ediyordu. Tek `curl` ile admin hesabı yaratılabiliyordu.

**Şu an nasıl çözülmüş:** `backend/routes/authRoutes.js:17` ucu `kayitKorumasi` middleware'i arkasına almış. `backend/middleware/kayitKorumasi.js:7-19` önce `SELECT COUNT(*) FROM kullanicilar` çalıştırıyor; sonuç 0 ise `req.ilkKurulum = true` işaretleyip geçiyor, değilse `dogrula` + `izinVer("admin")` zincirini uyguluyor. `backend/controllers/authController.js:19-28` rolü şöyle belirliyor: varsayılan `depo_sorumlusu`, ilk kurulumda zorla `admin`, aksi halde gövdeden gelen rol **beyaz listeye** (`GECERLI_ROLLER`) karşı doğrulanıyor.

**Çözüm yeterli mi:** Evet. Bootstrap deseni doğru uygulanmış ve rol ataması artık yalnızca kimliği doğrulanmış bir admin tarafından yapılabiliyor. Arayüz tarafı da tamamlanmış: `frontend/src/pages/Kullaniciler.jsx:46-56` bu ucu kullanarak admin'in yeni kullanıcı eklemesini sağlıyor — yani uç kapatılırken kullanılabilirlik feda edilmemiş.

**Daha iyi yapılabilir miydi:** İki küçük nokta. Birincisi, `kayitKorumasi` her kayıt isteğinde bir `COUNT(*)` çalıştırıyor; kullanıcı tablosu bir kez dolduktan sonra bu sorgu kalıcı olarak gereksiz — `dogrula` sonucu zaten yeterli bilgi veriyor, `COUNT` yalnızca 401 durumunda çalıştırılabilirdi. İkincisi, ilk kurulum ucu **hiç kapanmıyor**: veritabanı bir şekilde boşaltılırsa (yanlış migration, test ortamının prod'a bağlanması) uç yeniden herkese açılır. Bir `ilk_kurulum_tamamlandi` bayrağı veya kurulum token'ı bu pencereyi tamamen kapatırdı.

---

### F-02 — Kimlik doğrulaması olmayan okuma uçları · **Gerçekten kapandı**

**Eski problem:** `GET` uçlarının çoğunda `dogrula` yoktu; müşteri/tedarikçi PII'si, alış-satış fiyatları, ciro, stok seviyeleri ve depo yerleşimi token'sız okunabiliyordu.

**Şu an nasıl çözülmüş:** `backend/routes/index.js:5-7` varsayılanı tersine çevirmiş:

```
router.use("/auth", require("./authRoutes"));
router.use(dogrula);                       // bundan sonrası kimlik ister
```

`/auth` dışındaki 16 router bu satırın altında. Rapordaki tam öneri uygulanmış. Ayrıca `musteriController.js:14` ve `tedarikciController.js:14`'teki `SELECT *` de açık kolon listesine çevrilmiş — bu, raporun ikincil önerisiydi ve atlanmamış.

**Çözüm yeterli mi:** Evet, ve mimari olarak doğru biçimde: yeni eklenen her uç artık **varsayılan olarak korunuyor**, istisna bilinçli yazılmak zorunda. Bu, tek tek uçlara `dogrula` eklemekten kalıcı olarak daha güvenli.

**Daha iyi yapılabilir miydi:** Kapatma doğru ama bir yan etki bırakmış: alt router dosyalarındaki eski `dogrula` çağrıları **temizlenmemiş**. 14 route dosyasında hâlâ `dogrula` referansı var ve global `router.use(dogrula)` ile birlikte middleware **iki kez** çalışıyor — istek başına iki fazla veritabanı sorgusu. Ayrıntı için Y-17.

Ayrıca yetkilendirme hâlâ yalnızca "kimlik doğrulanmış mı" düzeyinde: `GET /musteriler` gibi PII uçları `izinVer` ile rol kısıtlamasına tabi değil, her depo sorumlusu tüm müşteri listesini görebiliyor. Bu bir açık değil, bilinçli bir kapsam kararı olabilir — ama KVKV açısından "en az yetki" ilkesi henüz uygulanmamış.

---

### F-03 / F-04 — Satınalma teslim alma ve satış teslim etme çift işlenebiliyor · **Gerçekten kapandı, çift savunma hattı ile**

**Eski problem:** Sipariş durumu kontrolü `beginTransaction()` çağrısından **önce** ve `FOR UPDATE` olmadan yapılıyordu; iki eşzamanlı istek aynı siparişin stoğunu iki kez işleyebiliyordu.

**Şu an nasıl çözülmüş:** Her iki controller'da da desen düzeltilmiş.

`backend/controllers/satinalmaController.js:147-152`:
```
await connection.beginTransaction();
const [siparisRows] = await connection.query(
  "SELECT id, durum FROM satinalma_siparisleri WHERE id = ? FOR UPDATE", [id],
);
```
`backend/controllers/satisController.js:170-175` aynı desen.

Üstelik ikinci savunma hattı da kurulmuş: `satinalmaController.js:249-261` durum güncellemesini `WHERE id = ? AND durum <> 'teslim_alindi'` koşuluyla yapıyor ve `affectedRows === 0` ise rollback edip **409** dönüyor. `satisController.js:311-323` aynısını `AND durum = 'beklemede'` ile yapıyor. `AUDIT.md` bu senaryonun paralel `curl` ile fiilen test edildiğini not ediyor (200 → 210, 220 değil).

**Çözüm yeterli mi:** Evet. Kilit + koşullu güncelleme kombinasyonu bu sınıf hatanın standart çözümüdür ve doğru uygulanmış. `satisController.teslimEt` ayrıca birim düzeyinde de koşullu düşüm yapıyor (`satisController.js:274-285`: `WHERE id = ? AND miktar >= ?`), yani stok tarafında da yarış koruması var.

**Daha iyi yapılabilir miydi:** İki nokta. Birincisi, koruma **sipariş tabanlı** işlemleri kapsıyor ama `POST /stok-hareketleri` ve `POST /transferler` doğaları gereği tekrarlanabilir işlemler; onlarda hâlâ idempotanlık anahtarı yok (F-15, açık). İkincisi, `satisController.js:311` koşulu `durum = 'beklemede'` — `hazirlaniyor` durumundaki bir sipariş teslim edilemiyor. Arayüz (`SatisSiparisleri.jsx:390`) "Teslim Et" butonunu `durum !== 'teslim_edildi' && durum !== 'iptal'` koşuluyla gösterdiği için, `hazirlaniyor` durumu bir gün yazılmaya başlanırsa buton görünür ama 409 döner. Şu an `hazirlaniyor` hiç yazılmadığı için sorun tetiklenmiyor (bkz. Y-12).

---

### F-05 — Satınalma siparişi oluşturmada transaction yok · **Gerçekten kapandı, üstelik fazlasıyla**

**Eski problem:** Sipariş başlığı ve kalemleri ayrı `pool.query` çağrılarıyla, transaction dışında yazılıyordu; yarım sipariş kalabiliyordu. Ayrıca `tedarikci_id` doğrulanmıyordu → `JOIN tedarikciler` yüzünden listede hiç görünmeyen "görünmez sipariş".

**Şu an nasıl çözülmüş:** `backend/controllers/satinalmaController.js:51-133` tamamen yeniden yazılmış:
- `pool.getConnection()` + `beginTransaction` + `commit`/`rollback` + `finally { connection.release() }`
- `tedarikci_id` transaction içinde `SELECT id FROM tedarikciler WHERE id = ?` ile doğrulanıyor (satır 85-93), yoksa 404
- Her kalem için `varyant_id` varlığı, `miktar > 0` ve `birim_fiyat >= 0` kontrolü **transaction başlamadan önce** yapılıyor (satır 64-81) — gereksiz transaction açılmıyor, doğru sıra
- Kalemler tek `INSERT ... VALUES ?` ile toplu yazılıyor (satır 115-120) — bu aynı zamanda F-18'in bu ayağını kapatıyor

`satisController.olustur` ile birebir simetrik hale gelmiş; raporun işaret ettiği "tutarsız uygulama" sorunu ortadan kalkmış.

**Çözüm yeterli mi:** Evet.

**Daha iyi yapılabilir miydi:** `kalem.varyant_id` yalnızca "boş değil mi" diye kontrol ediliyor (satır 68), varlığı doğrulanmıyor. Var olmayan bir varyant id'si gönderilirse `INSERT` yabancı anahtar hatası verir ve `hataYonetici` üzerinden **500** döner — geliştirme ortamında üstelik ham MySQL mesajıyla. `tedarikci_id` için yapılan doğrulama kalemler için yapılmamış; `SELECT id FROM urun_varyantlari WHERE id IN (?)` ile tek sorguda kontrol edilip anlamlı bir 400 dönebilirdi. `satisController.olustur:106-118` aynı eksikliği taşıyor.

Ayrıca `toplam_tutar` hâlâ **istemciden gelen** `birim_fiyat` ile hesaplanıyor (satır 95-98). Ürünün kayıtlı fiyatıyla karşılaştırılmıyor; bir istemci istediği fiyatı gönderebilir. Bu bir güvenlik açığından çok bir muhasebe güvenilirliği sorunu (bkz. Y-19'un ilgili notu ve F-29).

---

### F-06 — Pasif kullanıcı giriş yapabiliyor · **Gerçekten kapandı, ikincil sorun da dahil**

**Eski problem:** `girisYap` `aktif` kolonunu hiç kontrol etmiyordu. İkincil sorun: rol/durum değişikliği mevcut token'ları etkilemiyordu.

**Şu an nasıl çözülmüş:** İki katman:
1. `backend/controllers/authController.js:70-74` — `if (!kullanici.aktif) return res.status(403)`. Kontrol **parola doğrulamasından sonra** yapılmış; bu, hesabın var olup olmadığını sızdırmamak açısından doğru sıra.
2. Raporun "orta vadede" dediği DB tazeleme fiilen yapılmış: `backend/middleware/auth.js:22-36` her istekte `SELECT token_surumu FROM kullanicilar WHERE id = ?` çalıştırıp payload'daki `tv` ile karşılaştırıyor. Uyuşmazsa 401 + "Oturumunuz sonlandırıldı".

**Çözüm yeterli mi:** Giriş engelleme tarafında evet, tam.

**Daha iyi yapılabilir miydi:** Burada gerçek bir boşluk var ve bu bir düzeltme değil **eksik düzeltme**: `dogrula` yalnızca `token_surumu` okuyor, `aktif` ve `rol` **okumuyor**. `token_surumu` ise yalnızca şifre değişiminde artıyor (`passwordController.js:58`). Sonuç: bir kullanıcı `Kullanicilar.jsx` üzerinden pasife alındığında **elindeki token 8 saate kadar geçerli kalmaya devam eder** — yeni giriş yapamaz ama açık oturumu çalışmaya devam eder ve stok hareketi yaratabilir. Aynısı rol düşürme için de geçerli: admin'den `depo_sorumlusu`'na düşürülen kullanıcı, token'ının kalan ömrü boyunca admin olarak davranır.

Düzeltme çok ucuz: `auth.js:24`'teki sorguya `aktif, rol` eklenip `if (!rows[0].aktif) return 401` kontrolü ve `req.kullanici.rol = rows[0].rol` ataması yapılması yeterli — sorgu zaten çalışıyor, ek maliyet sıfır. Alternatif olarak `kullaniciController.guncelle` içinde `token_surumu = token_surumu + 1` yapılabilirdi; bu tek satır, mevcut altyapıyla sorunu tamamen çözerdi. Bu bulgu Bölüm 2'de **DEV-06** olarak yeniden ele alınmıştır.

---

### F-07 — Brute-force koruması yok · **Kapandı**

**Eski problem:** `POST /auth/giris` hiçbir hız sınırı olmadan açıktı.

**Şu an nasıl çözülmüş:** `backend/routes/authRoutes.js:7-15` — `express-rate-limit`, 15 dakikada 10 deneme, `standardHeaders: true`, Türkçe hata mesajı. Bonus olarak `backend/routes/passwordRoutes.js:7-15` şifre değiştirme ucuna da 15 dk/5 deneme limiti koymuş; bu raporda istenmemişti, doğru bir ek.

**Çözüm yeterli mi:** Temel senaryo için evet.

**Daha iyi yapılabilir miydi:** Üç eksik var. (1) Limit **yalnızca IP başına**; raporun önerdiği "e-posta başına ayrı sayaç" uygulanmamış. NAT arkasındaki bir depoda 10 çalışan aynı IP'yi paylaşıyorsa meşru kullanıcılar birbirini kilitler; tersine, IP havuzu olan bir saldırgan limiti aşar. (2) `express.js` içinde `app.set("trust proxy", ...)` **ayarlanmamış** — uygulama bir reverse proxy (nginx) arkasına konursa `express-rate-limit` tüm istekleri proxy'nin tek IP'si olarak görür ve limit **tüm kullanıcılar için ortak** hale gelir; bu, üretime geçişte sessizce patlayacak bir yapılandırma hatası. (3) `bcryptjs` hâlâ kullanımda (`package.json:16`); raporun not ettiği gibi saf JS implementasyonu event loop'u bloklar. Paralel giriş isteklerinde bu bir DoS yüzeyi olarak kalıyor.

---

### F-08 — CORS tüm kaynaklara açık · **Kapandı**

**Eski problem:** `cors({ exposedHeaders: [...] })` — `origin` verilmediği için `Access-Control-Allow-Origin: *`.

**Şu an nasıl çözülmüş:** `backend/index.js:12-17` `origin: config.corsOrigin` kullanıyor. `backend/config/env.js:25-27` `CORS_ORIGIN` ortam değişkenini virgülle bölüp trim'liyor, tanımsızsa `["http://localhost:5173"]` varsayılanına düşüyor. `.env.example` de doldurulmuş.

**Çözüm yeterli mi:** Evet, raporun önerdiği biçimde.

**Daha iyi yapılabilir miydi:** Varsayılanın `localhost:5173` olması geliştirme kolaylığı sağlıyor ama üretimde `CORS_ORIGIN` unutulursa uygulama **hatasız başlar** ve frontend sessizce CORS hatası alır — teşhisi zor bir arıza. `config/env.js` zaten `NODE_ENV === "production"` bilgisine sahip (`uretim` alanı); üretimde `CORS_ORIGIN` yoksa `ZORUNLU` listesine dahil edip süreci durdurmak, mevcut "hatalı yapılandırmayla çalışmaktansa açıkça çök" felsefesiyle tutarlı olurdu.

---

### F-09 — Hata mesajı sızıntısı · **Kapandı**

**Eski problem:** `res.json({ hata: err.message })` — ham MySQL mesajları istemciye gidiyordu.

**Şu an nasıl çözülmüş:** `backend/middleware/hataYonetici.js:8-11`:
```
const mesaj = config.uretim && durumKodu >= 500 ? "Sunucu hatası" : err.message || "Sunucu hatası";
```
Üretimde 5xx hataların mesajı sabitleniyor. Sunucu tarafında `console.error` ile metod + URL + hata basılıyor (satır 6) — geliştirme ortamında teşhis edilebilirlik korunmuş.

**Çözüm yeterli mi:** Sızıntıyı durdurma amacına ulaşıyor.

**Daha iyi yapılabilir miydi:** Raporun önerdiği `AppError` / `isOperational` ayrımı **yapılmamış**; ayrım `statusCode >= 500` üzerinden yapılıyor. Controller'ların hiçbiri `err.statusCode` atamadığı için pratikte tüm beklenmedik hatalar 500 olur ve maskelenir — sonuç aynı. Ancak `err.statusCode` bir gün kullanılırsa (ör. üçüncü parti bir kütüphane 400'lük bir hata fırlatırsa) o hatanın ham mesajı üretimde de istemciye gider. Ayrıca `requestId` korelasyonu yok: kullanıcı "Sunucu hatası" gördüğünde, o hatayı sunucu loglarında bulmanın hiçbir yolu yok. Bu, F-30'un açık kalan kısmıyla birleşiyor.

---

### F-10 — Güvenlik header'ları / gövde sınırı yok · **Kapandı**

**Eski problem:** `helmet` yoktu, `express.json()` varsayılan limitle çalışıyordu, `sayimController` sınırsız kalem kabul ediyordu.

**Şu an nasıl çözülmüş:** `backend/index.js:11` `app.use(helmet())`, `backend/index.js:18` `express.json({ limit: "200kb" })`.

**Çözüm yeterli mi:** İlk iki madde için evet.

**Daha iyi yapılabilir miydi:** Raporun üçüncü maddesi — **`sayimController` içinde `kalemler.length` üst sınırı — uygulanmamış**. `backend/controllers/sayimController.js:18-20` yalnızca dizi mi ve boş mu diye bakıyor; üst sınır yok. 200 kB gövdeye yaklaşık 3.000-4.000 kalem sığar ve her biri döngü içinde 2-4 ayrı sorgu çalıştırır (satır 145-208) — tek istekle uzun süreli bir transaction ve `stok_birimleri` üzerinde geniş kilit birikimi. Aynı kalıp `satisController.teslimEt`'in `tahsisler` dizisinde ve `olustur`'un `kalemler` dizisinde de sınırsız. `lokasyonController.blokOlustur` bu dersi almış ve `MAKS_BLOK_KAYIT = 5000` sınırı koymuş (satır 3, 245-249); aynı disiplin diğer toplu uçlara yayılmamış.

Not: `helmet()` varsayılan yapılandırmasında `Strict-Transport-Security` yalnızca HTTPS üzerinden anlamlıdır ve `Content-Security-Policy` bir API için büyük ölçüde işlevsizdir. Bu bir kusur değil, sadece "helmet eklendi" ifadesinin tarayıcı tarafındaki gerçek kazanımının sınırlı olduğunun notu.

---

### F-11 — Çift kayıtlı stok → kaçınılmaz drift · **Yapısal sebebin yarısı kaldırıldı** (kalanı Bölüm 2'de)

**Eski problem:** Stok iki yerde tutuluyordu: `urun_varyantlari.miktar` (toplam) ve `varyant_lokasyon.miktar` (dağılım).

**Şu an nasıl çözülmüş:** `varyant_lokasyon` tablosu tamamen düşürülmüş — `db/schema.sql` içinde yok. Yerine `stok_birimleri` gelmiş (`schema.sql:145-164`) ve model belirgin biçimde daha doğru:

```sql
`tip` enum('palet','dokme') NOT NULL DEFAULT 'palet',
`kod` varchar(30) DEFAULT NULL,
`dokme_anahtar` varchar(50) GENERATED ALWAYS AS (
  (case when (`tip` = 'dokme') then concat(`varyant_id`,'-',`lokasyon_id`) end)
) STORED,
UNIQUE KEY `kod_tek` (`kod`),
UNIQUE KEY `dokme_tek` (`dokme_anahtar`),
```

Bu tasarım gerçekten iyi düşünülmüş: dökme stok için `(varyant_id, lokasyon_id)` üzerinde tekillik gerekiyor ama paletler için gerekmiyor. Generated column + UNIQUE kombinasyonu bunu tek kısıtla, kısmi indeks olmadan çözüyor — MySQL'de kısmi/filtreli indeks olmadığı düşünülürse doğru ve zarif bir çözüm. `ON DUPLICATE KEY UPDATE` kullanan dört yer (`stokHareketiController.js:154`, `transferController.js:164`, `sayimController.js:189`, `satinalmaController.js:228`) bu anahtara dayanıyor ve anahtar **şemada doğrulandı** — ilk raporun "Doğrulanamayanlar" 3. maddesi kapandı.

Yabancı anahtarlar da doğrulandı: `fk_birim_varyant`, `fk_birim_lokasyon`, `fk_birim_kullanici` (`schema.sql:161-163`) ve tüm sipariş/hareket tablolarında FK'ler mevcut. "Doğrulanamayanlar" 2. maddesi de kapandı.

**Çözüm yeterli mi:** Yarım. `varyant_lokasyon` kaldırılarak **dağılım tek kaynağa** indirildi, ama `urun_varyantlari.miktar` (`schema.sql:234`) hâlâ ayrı bir toplam olarak duruyor ve her işlemde ayrıca güncelleniyor. Sapma matematiksel olarak hâlâ mümkün ve **fiilen üretilebiliyor** (bkz. Y-02). Bu yüzden madde Bölüm 2'de **DEV-11** olarak devam ediyor.

**Daha iyi yapılabilir miydi:** Palet modeline geçiş, bu boyutta bir refactor için cesur ve doğru bir karardı. Yapılmayan tek şey aynı hamlede `urun_varyantlari.miktar`'ı düşürmekti — o zaman beş controller yerine bir kez dokunulmuş olurdu. `AUDIT.md:1043` bunu bilinçli olarak "test altyapısı kurulduktan sonra" diye ertelemiş; gerekçe savunulabilir, ancak test altyapısı da kurulmadığı için madde askıda kalmış.

---

### F-12 — Satış teslimde deadlock riski · **Tablo içi sıralama çözüldü, tablolar arası çözülmedi**

**Eski problem:** Kilitler `ORDER BY vl.miktar DESC` ile, yani veriye bağlı bir sırayla alınıyordu; kalemler arası sıralama da yoktu.

**Şu an nasıl çözülmüş:** `backend/controllers/satisController.js:168` birim id'lerini `sort((a,b) => a-b)` ile sıralıyor, `satisController.js:216-222` kilit sorgusunu `ORDER BY id FOR UPDATE` ile alıyor. Aynı disiplin `sayimController.js:73` (`ORDER BY id FOR UPDATE`), `sayimController.js:104` (`varyantIdleri.sort`), `satinalmaController.js:200` (`varyantIdleri.sort`), `transferController.js:123` (`ORDER BY lokasyon_id FOR UPDATE`) ve `satinalmaController.js:181` (`ORDER BY varyant_id`) içinde tutarlı biçimde uygulanmış.

Ayrıca `satisController.js:159-163` aynı birimin listede iki kez gönderilmesini engelliyor ve `satisController.js:201-214` sipariş kalemlerini varyant bazında **tekilleştiriyor** — raporun F-12 düzeltmesinin 1. maddesi (aynı varyanttan iki kalem varsa birleştir) tam olarak uygulanmış.

**Çözüm yeterli mi:** Tablo içi sıralama için evet, ve bu titiz bir iş. Ancak **tablolar arası kilit sırası hâlâ tutarsız** ve bu yeni bir deadlock yolu açıyor — ilk raporda hiç geçmeyen bir bulgu. Ayrıntı için **Y-01**.

**Daha iyi yapılabilir miydi:** `ER_LOCK_DEADLOCK` için otomatik retry (raporun 3. maddesi) eklenmemiş. InnoDB deadlock'u tespit edip bir transaction'ı geri alır; kullanıcı bugün sebepsiz bir hata görüyor ve işlemi elle tekrarlamak zorunda. 3 denemelik üstel bekleme, bu sistemlerde standart pratik ve `withTransaction` sarmalayıcısı yazılırken (F-23) tek yerde çözülebilirdi.

---

### F-14 — Sipariş iptali transaction'sız · **Kapandı**

**Eski problem:** Oku-kontrol-et-yaz yarışı; iki ayrı `pool.query` farklı bağlantılar kullanabiliyordu.

**Şu an nasıl çözülmüş:** `backend/controllers/satisController.js:342-360` tam olarak raporun önerdiği desende:
```
UPDATE satis_siparisleri SET durum = 'iptal' WHERE id = ? AND durum = 'beklemede'
```
`affectedRows === 0` ise ikinci bir okuma ile 404 mü 400 mü olduğu ayırt ediliyor ve mevcut durum kullanıcıya söyleniyor ("Bu sipariş iptal edilemez (durum: teslim_edildi)").

**Çözüm yeterli mi:** Evet. Tek ifadeli koşullu `UPDATE` atomik olduğu için transaction'a gerek yok; hem doğru hem ucuz.

**Daha iyi yapılabilir miydi:** İkinci okuma teorik olarak yine yarışabilir (o an durum değişmiş olabilir), ama bu yalnızca hata mesajının içeriğini etkiler, veri bütünlüğünü değil — kabul edilebilir. Asıl eksik başka yerde: **satınalma siparişleri için iptal ucu hiç yok** (bkz. Y-13).

---

### F-16 — Bağlantı sızıntısı riski · **Kapandı, istisnasız**

**Eski problem:** `catch` içinde `rollback()` patlarsa `release()` atlanıyordu; 10 böyle olay tüm uygulamayı kilitliyordu.

**Şu an nasıl çözülmüş:** Transaction kullanan **yedi** controller fonksiyonunun tamamında raporun önerdiği desen birebir uygulanmış:

| Dosya | Satır |
|---|---|
| `satisController.olustur` | 125-130 |
| `satisController.teslimEt` | 330-335 |
| `satinalmaController.olustur` | 127-132 |
| `satinalmaController.teslimAl` | 266-271 |
| `stokHareketiController.ekle` | 240-245 |
| `transferController.olustur` | 189-194 |
| `sayimController.kaydet` | 218-223 |
| `lokasyonController.sil` | 195-200 |
| `lokasyonController.blokOlustur` | 310-315 |
| `stockUnitController.palletize` | 171-179 |
| `kullaniciController.guncelle` | 93-98 |

Hepsinde `await connection.rollback().catch(() => {})` + `finally { connection.release(); }`. Tek bir istisna bulunamadı — bu, denetimde en tutarlı uygulanmış düzeltme.

**Çözüm yeterli mi:** Evet.

**Daha iyi yapılabilir miydi:** Raporun "daha iyisi" dediği `withTransaction(async (conn) => {...})` sarmalayıcısı yazılmamış; aynı 11 satırlık boilerplate 11 yerde tekrarlanıyor. Bugün hepsi doğru, ama 12. transaction yazıldığında birinin unutulma olasılığı hâlâ var. Bu F-23 ile birlikte ele alınmalı.

---

### F-19 — Bağlantı havuzu yapılandırılmamış · **Kısmen kapandı**

**Eski problem:** `connectionLimit` varsayılan 10, `queueLimit` sınırsız, `timezone` ve `decimalNumbers` ayarsız.

**Şu an nasıl çözülmüş:** `backend/config/db.js:10-13`:
```
waitForConnections: true,
connectionLimit: Number(process.env.DB_POOL_SIZE) || 20,
queueLimit: 50,
enableKeepAlive: true,
```

**Çözüm yeterli mi:** Havuz boyutu ve kuyruk sınırı için evet — sessiz çöküş senaryosu kapandı.

**Daha iyi yapılabilir miydi:** Raporun aynı maddesindeki **iki ayar atlanmış**: `timezone` ve `decimalNumbers`. Saat dilimi tarafında rapor tarafı doğru çözülmüş (`utils/tarih.js` ile yerel tarih + yarı açık aralık, `raporController.js:16-21`, `dashboardController.js:41-63`), ama **görüntüleme tarafı çözülmemiş**: `StokHareketleri.jsx:366` `new Date(h.tarih).toLocaleString("tr-TR")` yapıyor; mysql2 `datetime`'ı Node süreç saat dilimine göre `Date`'e çevirir, JSON'a ISO/UTC olarak serileştirilir, tarayıcı yerel saate geri çevirir. Sunucu ve tarayıcı aynı saat diliminde olduğu sürece sonuç doğru; farklı olduğunda hareket saatleri sessizce kayar (bkz. Y-25).

`decimalNumbers` ayarlanmadığı için `DECIMAL` kolonlar hâlâ string dönüyor; kodda `Number(...)` çağrıları her yere yayılmış durumda (`satisController.js:239`, `transferController.js:96`, `sayimController.js:148`, `stockUnitController.js:134` ...). Şu an her yerde doğru yapılmış — ama bu, tek bir unutmanın `"10" + 5 = "105"` tipi sessiz bir hataya dönüşeceği bir zemin. Tek satırlık bir ayar bu sınıfı tamamen kaldırırdı.

---

### F-20 — Kısmi kullanıcı güncellemesi patlıyor · **Kapandı, fazlasıyla**

**Eski problem:** `{ aktif: false }` gönderildiğinde `rol` `undefined` olup mysql2 patlıyordu; ayrıca son admin pasife alınabiliyordu.

**Şu an nasıl çözülmüş:** `backend/controllers/kullaniciController.js:38-48` beyaz listeli dinamik `SET` kuruyor: yalnızca `!== undefined` olan alanlar `guncellenecek` nesnesine giriyor, `ALANLAR` sabitine karşı filtreleniyor, hiç alan yoksa 400 dönüyor. `aktif` `Boolean(aktif)` ile normalize ediliyor (satır 40) — raporun tip doğrulama notu karşılanmış.

Raporun "ayrıca" dediği **son admin kilitlenmesi de çözülmüş** (satır 63-80): hedef aktif bir admin ise ve değişiklik onu admin olmaktan çıkaracaksa, `COUNT(*) WHERE rol='admin' AND aktif=TRUE` sorgusu transaction içinde `FOR UPDATE` kilitli hedef satırla birlikte çalışıp `<= 1` ise 409 dönüyor. Kendini değiştirme engeli de korunmuş (satır 28-32).

**Çözüm yeterli mi:** Evet, ve bu raporun ötesine geçen bir titizlik örneği.

**Daha iyi yapılabilir miydi:** Küçük bir yarış penceresi var: `FOR UPDATE` yalnızca **hedef** satırı kilitliyor; `COUNT(*)` kilitsiz. İki farklı admin'in aynı anda iki farklı admin'i düşürdüğü senaryoda ikisi de sayımı 2 görüp geçebilir. Pratikte neredeyse imkânsız ama teorik olarak açık; `SELECT ... FOR UPDATE` ile sayım yapmak veya `aktif admin sayısı` üzerinde bir kısıt kurmak kapatırdı.

Arayüz tarafında bir eksik daha var: `Kullanicilar.jsx:157-164` rol değişimini bir `<select>` `onChange`'ine bağlamış, **onay istemeden**. Yanlışlıkla bir tuşa basmak birini yönetici yapabiliyor — oysa çok daha az riskli olan silme işlemleri `OnayModal` ile korunuyor (bkz. Y-47).

---

### F-21 — Şema ve migration yönetimi yok · **Kısmen kapandı**

**Eski problem:** Repoda hiçbir DDL yoktu; veri modeli yalnızca çalışan bir MySQL sunucusunda yaşıyordu.

**Şu an nasıl çözülmüş:** `backend/db/schema.sql` (267 satır) repoda ve güncel — 12 tablonun tamamı, tüm kısıtlar, tüm indeksler, generated column dahil. `backend/db/README.md` sıfırdan kurulum adımlarını, ilk kullanıcı bootstrap'ını ve şemayı yeniden üretme komutunu belgeliyor.

Bu tek adım, ilk raporun **en büyük kör noktasını** kapattı: bu denetimde şemaya dair her ifade doğrulanabildi. "Doğrulanamayanlar" listesinin 1, 2, 3 ve 5. maddeleri kapandı.

**Çözüm yeterli mi:** Felaket kurtarma ve yeni geliştirici onboarding'i için evet.

**Daha iyi yapılabilir miydi:** Versiyonlanmış migration hâlâ yok ve `db/README.md` bunu dürüstçe kabul ediyor. Somut maliyet zaten görünür: `AUDIT.md:1049` "bu hafta içinde altı `ALTER TABLE` elle çalıştırıldı ve hiçbiri repoda kayıtlı değil" diyor. Bir sonraki geliştirici (veya altı ay sonraki aynı geliştirici) mevcut veritabanını yeni şemaya nasıl taşıyacağını bilemez — `schema.sql` yalnızca **sıfırdan kurulum** için işe yarar, **yükseltme** için değil. Bu bölüm 2'de **DEV-21** olarak devam ediyor.

Ayrıca `schema.sql` `DROP TABLE IF EXISTS` içeriyor ve `README` onu doğrudan `mysql wms < schema.sql` ile çalıştırmayı öneriyor. Dolu bir veritabanına yanlışlıkla uygulanırsa **tüm veri silinir**. Dosyanın başına bir uyarı bloğu veya `README`'de kalın bir not gerekir.

---

### F-25 — Ortam ayrımı yok · **Kapandı**

**Eski problem:** `baseURL: "http://localhost:3000"` kodda sabitti; production build çalışmıyordu.

**Şu an nasıl çözülmüş:** `frontend/src/api/axios.js:3-9`:
```
const baseURL = import.meta.env.VITE_API_URL;
if (!baseURL) { throw new Error("VITE_API_URL tanımlı değil. ..."); }
```
Tanımsızsa uygulama açılışta, açıklayıcı bir mesajla duruyor. `frontend/.env.example` mevcut ve içinde "bu dosyadaki değerler bundle'a gömülür — GİZLİ BİLGİ KOYMAYIN" uyarısı var; bu, Vite'ın en sık yapılan hatasına karşı doğru bir not.

**Çözüm yeterli mi:** Evet.

**Daha iyi yapılabilir miydi:** İki nokta. (1) Hata `axios.js` modül gövdesinde fırlatılıyor; React ağacının dışında olduğu için kullanıcı **tamamen boş bir sayfa** görür, mesaj yalnızca konsolda kalır. Bir `ErrorBoundary` veya `index.html` içinde bir fallback mesaj bunu insan okunur hale getirirdi (bkz. Y-31). (2) `.env.development` / `.env.production` ayrımı yapılmamış, tek `.env` var. Vite bu dosyaları yerleşik olarak destekliyor; ayrım yapılmadığı için üretim build'i alan kişi `.env`'i elle değiştirmek zorunda.

---

### F-26 / F-27 — `/test-db` ucu ve env doğrulaması · **Kapandı**

**Eski problem:** `/test-db` kimlik doğrulamasız açıktı ve `err.message` (DB host/port/kullanıcı içerebilir) döndürüyordu. `.env.example` `JWT_SECRET` içermiyordu, başlangıçta env doğrulaması yoktu.

**Şu an nasıl çözülmüş:**
- `backend/index.js:20-28` — `/saglik` ucu `SELECT 1` çalıştırıyor, başarısızlıkta **503 + sabit mesaj** dönüyor (`{ durum: "hata", veritabani: "baglanamadi" }`), gerçek hata yalnızca sunucu loguna yazılıyor. Sızıntı kapalı.
- `backend/config/env.js:3-19` — `DB_HOST, DB_USER, DB_NAME, JWT_SECRET` zorunlu; eksikse hangi anahtarların eksik olduğunu yazıp `process.exit(1)`. Ayrıca `JWT_SECRET.length < 32` kontrolü ve `openssl rand -base64 48` üretme talimatı. Raporun tam önerisi, üstelik uzunluk kontrolü dahil.
- `.env.example` `JWT_SECRET=` satırını ve üretme komutunu içeriyor.

**Çözüm yeterli mi:** Evet. "Hatalı yapılandırmayla çalışmaktansa açıkça çök" ilkesi doğru uygulanmış.

**Daha iyi yapılabilir miydi:** `/saglik` ucu **`routes` middleware'inden önce** tanımlandığı için (`index.js:20` vs `index.js:30`) `dogrula` kapsamı dışında — bu bilinçli ve doğru (liveness probe token bilmez). Ancak uç, bir DB ping'i tetiklediği için kimlik doğrulamasız bir kaynak tüketim yüzeyi; `express-rate-limit` uygulanmamış. Düşük risk ama not edilmeli.

Ayrıca `DB_PASSWORD` zorunlu listesinde yok. Boş parola ile bağlanan bir MySQL kurulumu sessizce kabul ediliyor — `.env.example` bile `DB_PASSWORD=` boş bırakıyor. Geliştirmede pratik, üretimde tehlikeli.

---

### F-28 — Bağımlılık güvenlik açıkları · **Backend kapandı, frontend kararı belgelenmiş ama tablo değişti**

**Eski problem:** Frontend'de `react-router` (yüksek), backend'de `brace-expansion` (yüksek, dev bağımlılığı).

**Şu an nasıl çözülmüş:** Backend `npm audit` → **0 açık** (doğrulandı). Frontend'deki `react-router` bulgusu için `AUDIT.md:820-851`'de gerekçeli, koşulları yazılı bir **kabul edilen risk** kararı verilmiş. Karar metodolojik olarak örnek niteliğinde: advisory doğrudan okunmuş, "yalnızca unstable RSC API'leri etkiler" notu tespit edilmiş, projenin `BrowserRouter` ile saf istemci SPA olduğu doğrulanmış, üç düzeltme seçeneği tek tek değerlendirilip reddedilme gerekçeleri yazılmış ve **yeniden değerlendirme koşulları** tanımlanmış.

**Çözüm yeterli mi:** Karar süreci açısından evet — bu, denetimde en olgun mühendislik kararı. `npm audit` skorunu görüp refleksle `--force` çalıştırmamak doğru tercih.

**Daha iyi yapılabilir miydi:** Tablo bu denetimde **değişti** ve bu değişiklik izlenmiyor. 4 Ağustos ölçümü:

```
frontend: 3 high, 1 moderate (toplam 4)
  react-router      7.12.0 - 8.2.0   high      (bilinen, kabul edilmiş)
  react-router-dom  >=7.12.0-pre.0   high      (yukarıdakinin taşıyıcısı)
  brace-expansion   4.0.0 - 5.0.8    high      YENİ — DoS, CVE-2026-14257 mitigasyonunu atlatıyor
  postcss           <=8.5.22         moderate  YENİ — sourceMappingURL ile keyfi .map okuma
backend: 0 açık
```

İkisi de dev bağımlılığı (vite zinciri) ve production runtime'a girmiyor, yani etki düşük — ama **hiçbiri repoda kayıtlı değil**. Kabul edilen risk kararı bir kereye mahsus yazılmış, süregelen bir süreç kurulmamış. `npm audit --audit-level=high` adımı bir CI'ya bağlanmadığı için tablo sessizce değişiyor. Raporun kendi önerisinin son cümlesi ("CI'ya `npm audit` adımı ekle") uygulanmamış — ve zaten CI de yok.

---

### Raporda olmayan, sonradan bulunup düzeltilenler · **Doğrulandı**

`AUDIT.md:55-61`'de listelenen üç madde de kodda doğrulandı:

| Bulgu | Doğrulama |
|---|---|
| **Saat dilimi karışıklığı** | `backend/utils/tarih.js` yerel tarih üretiyor; `raporController.js:16-21` ve `dashboardController.js:59-63` **yarı açık aralık** (`>= altSinir AND < ustSinir`) kullanıyor — `23:59:59` yaklaşımının kaçırdığı saniyeler sorunu da çözülmüş. `gecerliGunMu` ile `YYYY-MM-DD` biçim doğrulaması var. Doğru yapılmış. |
| **Sayım varyant bazlıydı** | `sayimController.kaydet` artık `birim_id` bazlı çalışıyor (`sayimController.js:32-42`), varyant bazlı giriş yalnızca dökme için ikincil yol olarak duruyor ve ikisinin çakışması aktif olarak engelleniyor (satır 89-102). Aynı birimin veya aynı varyantın iki kez gönderilmesi de reddediliyor (satır 35-39, 49-53) — ilk raporun "Doğrulanamayanlar" 12. maddesi kapandı. |
| **`paletteki_adet` yanlış model** | Kolon `schema.sql`'de yok. Kapasite kontrolü `healthController.js:43-57`'de `COUNT(*) WHERE tip='palet'` ile yapılıyor. Doğrulandı. (Ancak `kapasite` alanının anlamı hâlâ çelişkili — bkz. Y-15.) |

### Rapor kapsamı dışında eklenen yetenekler · **Doğrulandı ve değerlendirildi**

- **Palet (LPN) modeli** (`stok_birimleri`) — yukarıda F-11'de değerlendirildi. Model doğru, generated column çözümü zarif.
- **Barkod ile palet sorgulama** — `GET /stok-birimleri/kod/:kod` (`stockUnitController.js:59-88`), arayüzü `Pallets.jsx`. `autoFocus` + form submit ile barkod okuyucunun klavye davranışına uygun. Doğru tasarlanmış.
- **Birim bazlı toplama** — `PickingModal.jsx` + `satisController.teslimEt`. Sunucu, seçilen toplamı sipariş miktarıyla **iki yönlü** doğruluyor (satır 252-269: hem eksik/fazla hem "siparişte olmayan ürün seçilmiş" kontrolü). Titiz.
- **Şifre değiştirme + oturum sonlandırma** — `passwordController.js` + `token_surumu`. Mevcut şifre doğrulaması, yeni şifrenin eskiyle aynı olamaması, işlem sonrası taze token dönmesi (kullanıcının kendi oturumu düşmesin diye) — hepsi düşünülmüş.
- **Sistem sağlığı ekranı** — `healthController.js` dört kontrol çalıştırıyor, `Promise.all` ile paralel. Kontrollerin her biri kolon meta verisiyle birlikte dönüyor ve `SystemHealth.jsx` bunu jenerik olarak render ediyor; yeni bir kontrol eklemek yalnızca backend'e dokunmayı gerektiriyor. İyi bir soyutlama.
- **Panel grafikleri** — `dashboardController.js`, üç sorgu paralel, eksik günler `buildDayRange` ile sıfırla dolduruluyor (satır 78-85) — grafikte boşluk oluşmuyor. Doğru detay.

---

### Bölüm 1 Özeti

| ID | Başlık | Doğrulanan durum |
|---|---|---|
| F-01 | Açık kayıt ucu | ✅ Kapalı |
| F-02 | Auth eksikliği | ✅ Kapalı (artık default-deny) |
| F-03 | Satınalma çift teslim | ✅ Kapalı (kilit + koşullu update) |
| F-04 | Satış çift teslim | ✅ Kapalı (aynı desen) |
| F-05 | Satınalma transaction yok | ✅ Kapalı |
| F-06 | Pasif kullanıcı girişi | ✅ Giriş kapalı — **oturum iptali eksik (DEV-06)** |
| F-07 | Brute-force | ✅ Kapalı (IP bazlı) |
| F-08 | CORS | ✅ Kapalı |
| F-09 | Hata sızıntısı | ✅ Kapalı |
| F-10 | helmet + gövde sınırı | ✅ Kapalı — **kalem sayısı sınırı eksik (Y-10 grubu)** |
| F-11 | Çift kayıtlı stok | ⚠️ Yarısı — **DEV-11** |
| F-12 | Deadlock (tablo içi) | ✅ Kapalı — **tablolar arası açık (Y-01)** |
| F-14 | İptal yarışı | ✅ Kapalı |
| F-16 | Bağlantı sızıntısı | ✅ Kapalı, istisnasız |
| F-19 | Havuz ayarı | ⚠️ Havuz kapalı, `timezone`/`decimalNumbers` açık |
| F-20 | Kullanıcı güncelleme | ✅ Kapalı, son-admin koruması dahil |
| F-21 | Şema | ⚠️ `schema.sql` var, migration yok — **DEV-21** |
| F-25 | Ortam ayrımı | ✅ Kapalı |
| F-26/27 | `/saglik` + env doğrulama | ✅ Kapalı |
| F-28 | Bağımlılıklar | ⚠️ Backend temiz, frontend tablosu değişti (izlenmiyor) |

**19 madde tamamen kapalı, 5 madde kısmen. Kritik ve yüksek önemli güvenlik bulgularının tamamı gerçekten kapatılmış — `AUDIT.md`'nin iddiası doğrulandı.**

---

## 2. HÂLÂ DEVAM EDENLER ⚠️

`AUDIT.md`'de bulunan ve bu denetimde hâlâ açık olduğu **kod üzerinde doğrulanan** maddeler.

---

### DEV-11 — `urun_varyantlari.miktar` ayrı bir toplam olarak duruyor · **Öncelik: High**

**Problem:** F-11'in yapısal sebebinin yarısı kaldırıldı (`varyant_lokasyon` düşürüldü), ama toplam stok hâlâ `urun_varyantlari.miktar` kolonunda ayrıca tutuluyor ve her stok işleminde ikinci bir `UPDATE` ile güncelleniyor.

**Bulunduğu dosya:**
- `backend/db/schema.sql:234` — `miktar decimal(12,2) NOT NULL DEFAULT '0.00'`
- Toplamı güncelleyen beş ayrı yer: `stokHareketiController.js:145-148` (giriş), `stokHareketiController.js:216-219` (çıkış), `satinalmaController.js:208-213` (`CASE` ile toplu), `satisController.js:292-295` (teslim), `sayimController.js:139-142` (sayım düzeltmesi)
- Sapmayı raporlayan iki uç: `lokasyonController.js:318-336`, `healthController.js:3-14`

**Neden hâlâ problem:** Aynı gerçeğin iki yerde tutulması, ikisini güncelleyen her yolun kusursuz olmasını gerektirir. Kod bugün beş yolda da doğru yapıyor — ama altıncı bir yol var ve o **bozuk**: `varyantController.ekle` doğrudan `miktar` alıp hiçbir `stok_birimleri` satırı yaratmadan varyant oluşturabiliyor (bkz. Y-02). Yani sapma teorik değil, **arayüzden üretilebilir durumda**.

Sistemin bu konuda kendi kendisiyle çeliştiğini gösteren somut kanıt: `SystemHealth.jsx` ekranı bu sapmayı `seviye: "kritik"` olarak raporluyor (`healthController.js:72`) — yani proje, bir ekranıyla ürettiği durumu başka bir ekranıyla "kritik hata" diye işaretliyor.

**Etkisi:** Sapma oluştuğunda stoğun nerede olduğu bilinmez hale gelir. Toplam 100 gösterirken lokasyonlarda 80 varsa, 20 adet ne satılabilir ne de bulunabilir. `dusukStok` (`varyantController.js:69-82`) ve panel `toplam_stok` (`urunController.js:30`) bu bozuk toplamı kullandığı için satın alma kararları da yanlış sayıya dayanır. Düzeltmenin tek yolu elle sayım.

**Nasıl düzeltilmeli:**
1. Kolonu düşür. Toplamı `SUM(stok_birimleri.miktar)` ile hesapla. Sapma matematiksel olarak imkânsız hale gelir.
2. Bedeli: `varyantController.listele` (`SELECT v.*`), `dusukStok`, `urunController.listele` ve `Panel` sorguları `LEFT JOIN stok_birimleri ... GROUP BY` deseninе geçer. `stok_birimleri(varyant_id)` indeksi zaten var (`schema.sql:158 idx_varyant`), yani sorgu maliyeti kabul edilebilir.
3. `dusukStok` için `HAVING SUM(...) <= v.kritik_seviye` gerekir; bu sorgu tam tarama yapacağı için varyant sayısı çok büyürse materialized bir görünüm gerekebilir — ama bugünkü ölçekte (16 varyant) sorun değil.
4. **Ön koşul:** F-22 (test). `AUDIT.md:1043` bunu doğru sıralamış; testler olmadan beş controller'a birden dokunmak riskli.

**Ara çözüm (bugün yapılabilir):** `varyantController.ekle`'den `miktar` alanını kaldırmak (Y-02). Bu tek değişiklik, sapmayı üretebilen bilinen tek yolu kapatır ve kolonun kaldırılmasını beklerken sistemi tutarlı tutar.

---

### DEV-06 — Rol/durum değişikliği açık oturumları etkilemiyor · **Öncelik: High**

**Problem:** F-06'nın giriş engelleme kısmı kapandı ama "orta vadede" denen kısmı yarım kaldı. `dogrula` middleware'i veritabanından **yalnızca `token_surumu`** okuyor.

**Bulunduğu dosya:** `backend/middleware/auth.js:23-38`
```
const [rows] = await pool.query("SELECT token_surumu FROM kullanicilar WHERE id = ?", [payload.id]);
...
req.kullanici = payload;      // rol JWT payload'ından geliyor, DB'den değil
```
`token_surumu` yalnızca `passwordController.js:58`'de artıyor. `kullaniciController.guncelle` (satır 85-88) rolü/durumu değiştiriyor ama `token_surumu`'na **dokunmuyor**.

**Neden hâlâ problem:** Admin panelde "Pasife Al" butonuna basıldığında kullanıcının açık oturumu düşmüyor. Kullanıcı sekmesini kapatmadığı sürece 8 saate kadar (`authController.js:79`) çalışmaya devam eder — stok hareketi girebilir, sipariş oluşturabilir, teslim edebilir. Aynı şekilde admin'den `depo_sorumlusu`'na düşürülen biri, `izinVer("admin")` korumalı uçları (kullanıcı yönetimi, lokasyon silme, blok oluşturma, sistem sağlığı) token'ının kalan ömrü boyunca kullanmaya devam eder.

**Etkisi:** İşten ayrılan bir personelin erişimi kesildiği sanılırken kesilmemiş olur. Bu, ilk raporun F-06 için yazdığı "güvenlik kontrolünün var olduğu ama uygulanmadığı en tehlikeli sınıf" tanımının hafiflemiş ama devam eden hâli. Yönetici arayüzde "Kullanıcı pasife alındı" toast'ını görüyor ve işin bittiğini sanıyor.

**Nasıl düzeltilmeli:** İki seçenekten biri, ikisi de tek satırlık:
- **A (tercih):** `kullaniciController.js:86`'daki `UPDATE`'e `token_surumu = token_surumu + 1` ekle. Mevcut altyapı bunu zaten destekliyor, `dogrula` anında 401 dönmeye başlar. Rol değişiminde de doğru davranış (kullanıcı yeniden giriş yapıp taze rolle token alır).
- **B:** `auth.js:24`'teki sorguyu `SELECT token_surumu, aktif, rol` yap; `!rows[0].aktif` ise 401 dön ve `req.kullanici = { ...payload, rol: rows[0].rol }` ata. Sorgu zaten çalıştığı için ek maliyet sıfır; ayrıca rolü her istekte taze okumak "token içindeki rol eskiyebilir" sınıfını tamamen kapatır.

**Öncelik gerekçesi:** Critical değil çünkü sömürü için önce meşru bir oturum gerekiyor ve pencere 8 saatle sınırlı. High çünkü düzeltme tek satır ve sistemin sunduğu bir güvenlik garantisi fiilen çalışmıyor.

---

### DEV-13 — Rezervasyon / tahsis mekanizması yok · **Öncelik: High**

**Problem:** F-13 hiç ele alınmamış. `satisController.olustur` (satır 49-131) siparişi `beklemede` yazıyor ve stoğa hiç dokunmuyor. Stok ilk kez `teslimEt` içinde kontrol ediliyor (satır 239).

**Bulunduğu dosya:** `backend/controllers/satisController.js:49-131`, `frontend/src/pages/SatisSiparisleri.jsx:255-257`

**Neden hâlâ problem:** 100 adet stoğu olan bir ürün için 10 ayrı müşteriye 50'şer adetlik sipariş açılabiliyor; sistem hiçbirinde uyarmıyor. Arayüzde bir "yetersiz stok" uyarısı var (`SatisSiparisleri.jsx:256`) ama **bloklamıyor**, sadece kırmızı yazı gösteriyor — ve dayandığı `varyantlar` verisi sayfa açılışında bir kez çekilip bir daha yenilenmiyor (`SatisSiparisleri.jsx:76-78`), yani gösterilen stok saatler öncesine ait olabilir.

**Etkisi:** Problem, müşteriye söz verildikten ve mal hazırlanmaya başlandıktan **sonra**, toplama ekranında ortaya çıkıyor. Depo operasyonunda en pahalı hata anı bu. Ayrıca "kullanılabilir stok" kavramı hiçbir yerde yok: `dusukStok` ve panel `toplam_stok` fiziksel stoğu gösteriyor, bekleyen siparişlere söz verilmiş miktarı değil — satın alma kararları eksik bilgiyle veriliyor.

**Nasıl düzeltilmeli:** Ayrı bir `stok_rezervasyonlari` tablosu (`id, siparis_id, varyant_id, miktar, olusturulma, durum`). Sipariş oluşturulurken rezervasyon yazılır, `SUM(stok_birimleri.miktar) - SUM(rezerve) < gereken` ise sipariş reddedilir. Teslimde rezervasyon düşülür, iptalde serbest bırakılır. Ayrı tablo, `stok_birimleri`'ne kolon eklemekten üstün: rezervasyonun kime ait olduğu, ne zaman yapıldığı ve zaman aşımı takip edilebilir; ayrıca palet modeliyle birlikte birim düzeyinde rezervasyon da mümkün hale gelir.

`AUDIT.md:1045` bunu doğru tespit etmiş: palet modeline geçiş bu işi kolaylaştırdı.

---

### DEV-15 — İdempotanlık anahtarı yok · **Öncelik: Medium**

**Problem:** F-15 açık. Hiçbir yazma ucunda `Idempotency-Key` benzeri mekanizma yok.

**Bulunduğu dosya:** Tüm `POST`/`PATCH` uçları; özellikle `POST /stok-hareketleri` (`stokHareketiController.js:80`), `POST /transferler` (`transferController.js:38`), `POST /sayim` (`sayimController.js:5`), `POST /stok-birimleri/paletle` (`stockUnitController.js:90`)

**Neden hâlâ problem:** F-03/F-04'teki durum kilitleri **sipariş tabanlı** işlemleri koruyor: "bu sipariş zaten teslim alındı" diye bir durum var. Ama "A rafından 10 adet çıkar" isteği doğası gereği tekrarlanabilir — iki kez gelirse ikisi de meşru görünür ve 20 adet çıkar. `stok_hareketleri` tablosunda (`schema.sql:169-186`) tekrarı engelleyecek doğal bir anahtar yok.

Arayüz tarafındaki koruma **tutarsız**:

| Yer | In-flight koruması |
|---|---|
| `PickingModal.jsx:201` (`gonderiliyor`) | ✅ Var |
| `TransferModal.jsx:118` (`gonderiliyor`) | ✅ Var |
| `DepoHaritasi.jsx:338` (`paletKaydediliyor`) | ✅ Var |
| `TeslimAlModal.jsx:49` (`gonderiliyor`) | ⚠️ Var ama işlevsiz — bkz. Y-40 |
| `SatisSiparisleri.jsx:168` sipariş oluştur | ❌ Yok |
| `SatinalmaSiparisleri.jsx:157` sipariş oluştur | ❌ Yok |
| `StokHareketleri.jsx:124` hareket ekle | ❌ Yok |
| `Varyantlar.jsx:123`, `Urunler.jsx:59`, `Musteriler.jsx:46`, `Tedarikciler.jsx:46`, `Kategoriler.jsx:33` | ❌ Yok |

**Etkisi:** Çift tıklama iki stok hareketi, iki sipariş, iki müşteri kaydı yaratır. Depoda kablosuz el terminali kullanılan bir senaryoda (bağlantı kesintisi + otomatik retry) bu düzenli olarak yaşanır. Barkod okuyucu desteği genişletilirse risk artar — okuyucular tek okutmada iki sinyal gönderebilir.

**Nasıl düzeltilmeli:** İki katman. (1) **Bugün, ucuz:** yukarıdaki tabloda ❌ olan yedi formda `gonderiliyor` state'i + `disabled` — mevcut üç örnekten kopyalanacak, bir saatlik iş. (2) **Doğrusu:** `islem_anahtarlari (anahtar VARCHAR(64) PRIMARY KEY, yanit JSON, olusturulma TIMESTAMP)` tablosu ve yazma uçlarında `Idempotency-Key` header'ı; transaction içinde `INSERT`, `ER_DUP_ENTRY` alınırsa saklanan yanıt döndürülür. İstemci anahtarı form açılırken `crypto.randomUUID()` ile üretir. Tek mekanizma tüm yazma uçlarını korur ve ileride çevrimdışı kuyruk yapılabilmesinin ön koşuludur.

---

### DEV-17 — Sayfalanmayan liste uçları · **Öncelik: Medium**

**Problem:** F-17 kısmen kapandı. Müşteriler, tedarikçiler, satış ve satınalma siparişleri `buildPagination` ile sayfalandı. Ama **beş uç hâlâ sayfalanmıyor** ve iki uçta sayfalama isteğe bağlı + üst sınırsız.

**Bulunduğu dosya ve durum:**

| Uç | Dosya:satır | Durum |
|---|---|---|
| `GET /lokasyonlar` | `lokasyonController.js:5-21` | ❌ Sayfalama yok. `LEFT JOIN stok_birimleri + GROUP BY l.id` ile **her çağrıda tüm stok dağılımı taranıyor** |
| `GET /varyantlar/dusuk-stok` | `varyantController.js:69-82` | ❌ Limitsiz |
| `GET /kategoriler` | `kategoriController.js:3-16` | ❌ Limitsiz (küçük tablo, düşük risk) |
| `GET /kullanicilar` | `kullaniciController.js:4-15` | ❌ Limitsiz (küçük tablo, düşük risk) |
| `GET /stok-birimleri` | `stockUnitController.js:33-51` | ⚠️ `LIMIT 500` kodda sabit, offset yok — ama `X-Toplam-Kayit` **dönüyor** |
| `GET /varyantlar` | `varyantController.js:54-60` | ⚠️ `if (sayfa \|\| limit)` — parametre yoksa **tüm tablo**; ayrıca `limit` üst sınırsız |
| `GET /urunler` | `urunController.js:39-47` | ⚠️ Aynı desen, `limit` üst sınırsız |

**Neden hâlâ problem:** `utils/pagination.js` doğru yazılmış (`MAKS_LIMIT = 500`, negatif/NaN koruması) ama **yalnızca dört controller'da kullanılıyor** (`musteri`, `tedarikci`, `satis`, `satinalma`). Diğerleri kendi ad-hoc mantığını yazmış:

```js
// varyantController.js:55-56 — üst sınır yok
const limitSayi = parseInt(limit, 10) || 20;

// stokHareketiController.js:67 — üst sınır 100
const limitSayi = Math.min(parseInt(limit, 10) || 20, 100);

// transferController.js:8 — üst sınır 200
const limitSayi = Math.min(parseInt(limit, 10) || 50, 200);
```
Üç farklı dosyada üç farklı üst sınır ve bir dosyada hiç sınır yok. `GET /varyantlar?limit=999999` bugün kabul ediliyor.

**Etkisi:** İlk kırılma noktası `GET /lokasyonlar`. `blokOlustur` tek seferde 5.000 palet yeri üretebiliyor ve bu uç `DepoHaritasi`, `LokasyonYonetimi`, `Sayim`, `StokHareketleri`, `SatinalmaSiparisleri` sayfalarının **her açılışında** çağrılıyor — beş sayfa, aynı ağır sorgu. `stok_birimleri.lokasyon_id` indeksi var (`schema.sql:159`) ama `GROUP BY l.id` yine de tüm lokasyon tablosunu tarıyor.

İkinci kırılma noktası `GET /stok-birimleri`: `X-Toplam-Kayit` header'ı doğru toplamı dönerken sorgu `LIMIT 500` uyguluyor. `Pallets.jsx` bu header'ı hiç okumuyor, sadece listeyi basıyor — 501. palet **sessizce yok sayılıyor** ve kullanıcı bunu asla öğrenemiyor.

**Nasıl düzeltilmeli:**
1. `buildPagination`'ı tüm liste uçlarında **zorunlu** kıl; ad-hoc üç kopyayı sil. Üst sınır tek yerden yönetilsin.
2. `stockUnitController.list`'e `offset` ekle, `Pallets.jsx`'e sayfalama koy (desen projede zaten dört yerde var, kopyalanacak).
3. `GET /lokasyonlar` için: harita ekranı tüm lokasyonlara ihtiyaç duyuyor (grid çizimi), ama `LokasyonYonetimi` tablosu duymuyor. İki uca ayır — `GET /lokasyonlar/harita` (hafif: id, kod, satir, kolon, span, tip, doluluk bayrağı) ve `GET /lokasyonlar` (sayfalı, tam veri).
4. `stok_hareketleri` gibi monoton büyüyen tablolarda offset yerine keyset sayfalaması: `WHERE (tarih, id) < (?, ?) ORDER BY tarih DESC, id DESC LIMIT ?`.

---

### DEV-18 — Döngü içinde tek tek sorgu · **Öncelik: Medium**

**Problem:** F-18 kısmen kapandı. `blokOlustur` ve iki sipariş oluşturma toplu `INSERT`'e geçti — ama üç sıcak yolda döngü içi sorgu duruyor.

**Bulunduğu dosya:**
- `backend/controllers/satisController.js:271-309` — teslim edilen her birim için **4 sorgu** (`UPDATE stok_birimleri`, `DELETE ... miktar=0`, `UPDATE urun_varyantlari`, `INSERT stok_hareketleri`). 20 paletlik bir siparişte 80 sorgu, hepsi tek transaction içinde.
- `backend/controllers/sayimController.js:145-208` — sayılan her birim için 3-4 sorgu (`hareketYaz` içinde 2 + döngüde 2).
- `backend/controllers/stokHareketiController.js` — tekil işlem olduğu için sorun değil.

**Neden hâlâ problem:** `satinalmaController.teslimAl` bu problemi **doğru çözmüş** ve nasıl yapılacağını gösteriyor: `UPDATE ... SET miktar = miktar + CASE id WHEN ? THEN ? ... END WHERE id IN (?)` (satır 208-213) ve tek `INSERT ... VALUES ?` (satır 242-247). Aynı teknik `teslimEt` ve `sayimController`'a uygulanmamış — yani bilgi eksikliği değil, tutarsız uygulama. İlk raporun F-05 için yazdığı teşhisin aynısı.

**Etkisi:** Her sorgu bir ağ gidiş-dönüşü. Yerel MySQL'de ihmal edilebilir, uzak veritabanında (managed MySQL, farklı AZ) 80 sorgu × 2 ms = 160 ms ek gecikme ve **o süre boyunca `stok_birimleri` ve `urun_varyantlari` satırları kilitli**. Kilit süresi uzadıkça eşzamanlı teslimatların birbirini bekleme olasılığı artıyor; bu, Y-01'deki deadlock riskini de büyütüyor.

**Nasıl düzeltilmeli:** `teslimEt` döngüsündeki dört sorguyu toplu hale getir: `UPDATE ... CASE` (miktar düşümü, `WHERE id IN (?)` + `AND miktar >= CASE...` ile koruma korunarak), tek `DELETE ... WHERE id IN (?) AND miktar = 0`, tek `UPDATE urun_varyantlari ... CASE`, tek `INSERT INTO stok_hareketleri ... VALUES ?`. Dört sorgu, birim sayısından bağımsız. `satinalmaController.teslimAl` bunun çalışan örneği.

---

### DEV-21 — Versiyonlanmış migration yok · **Öncelik: Medium**

**Problem:** F-21'in ikinci ayağı. `schema.sql` bir **anlık görüntü**, değişiklik geçmişi tutmuyor.

**Bulunduğu dosya:** `backend/db/` — yalnızca `schema.sql` ve `README.md`. `backend/package.json` bağımlılıklarında migration aracı yok.

**Neden hâlâ problem:** `db/README.md` sorunu dürüstçe kabul ediyor ama çözmüyor. `AUDIT.md:1049` somut maliyeti yazıyor: bir hafta içinde altı `ALTER TABLE` elle çalıştırılmış ve hiçbiri kayıtlı değil. Bugün çalışan bir veritabanı olan tek bir makinede bu görünmez; ikinci bir ortam (test sunucusu, başka bir geliştirici, üretim) olduğu anda "hangi ortam hangi durumda" sorusu cevapsız kalır.

**Etkisi:** `schema.sql` yalnızca **sıfırdan kurulum** için işe yarar, **yükseltme** için değil. Dolu bir veritabanını yeni şemaya taşımanın yazılı bir yolu yok. Ayrıca `schema.sql` `DROP TABLE IF EXISTS` içeriyor (satır 12, 22, 38 ...) ve `README` onu doğrudan çalıştırmayı öneriyor — dolu bir veritabanına yanlışlıkla uygulanırsa **tüm veri silinir**, geri dönüşü yok (yedekleme prosedürü de yok).

**Nasıl düzeltilmeli:**
1. `backend/db/migrations/0001_baseline.sql` olarak mevcut şemayı sabitle; `uygulanan_migrationlar (dosya VARCHAR(255) PRIMARY KEY, uygulanma TIMESTAMP)` tablosu ekle.
2. Uygulanmamış dosyaları sırayla çalıştıran 30 satırlık bir `npm run migrate` betiği yeterli — `umzug`/`knex` gibi bir bağımlılık şart değil ve bu projenin ölçeğinde fazla gelir.
3. `schema.sql`'in başına "BU DOSYA TÜM TABLOLARI SİLER" uyarısı; `README`'deki komuta `--one-database` benzeri bir güvenlik notu.
4. Yedekleme: günlük `mysqldump` + **geri yüklemenin test edildiği** yazılı prosedür. Bugün repoda yedekleme diye bir kavram yok; WMS'te veri kaybı operasyonun durması demektir.

---

### DEV-22 — Sıfır test · **Öncelik: High — raporun en büyük açık maddesi**

**Problem:** F-22 hiç ele alınmamış.

**Bulunduğu dosya:** `backend/package.json:7` → `"test": "echo \"Error: no test specified\" && exit 1"`. Test kütüphanesi bağımlılığı yok. Frontend'de de test yok, test scripti yok.

**Neden hâlâ problem:** Bu raporda anlatılan hataların hiçbiri manuel testle güvenilir şekilde yakalanamaz. Y-01'deki deadlock yalnızca iki işlem milisaniyeler arayla geldiğinde ortaya çıkar. DEV-11'deki sapma yalnızca belirli bir işlem sırasında oluşur. `AUDIT.md:1041` durumu açıkça anlatıyor: palet modeline geçerken beş controller'da miktar düşme mantığı değişmiş ve her seferinde Sistem Sağlığı ekranı **elle** yenilenip sapmaya bakılmış.

**Etkisi:** Bu, tek başına bir hata değil — **diğer tüm düzeltmelerin önündeki engel**. DEV-11 (kolonu kaldırma) beş controller'a dokunmayı gerektiriyor ve test olmadan yapılamaz. DEV-18 (toplu sorgular) stok matematiğini değiştiriyor, test olmadan yapılamaz. Y-01 (kilit sırası) doğrulanması ancak eşzamanlılık testiyle mümkün. Yol haritasının büyük kısmı bu maddeye bağlı.

**Nasıl düzeltilmeli:** Node'un yerleşik `node:test` runner'ı (ek bağımlılık gerektirmez) + Docker'da ayağa kalkan bir test MySQL'i. Hedef %100 kapsam değil, **beş senaryo**:

1. **Stok değişmezi (en önemli):** bir dizi giriş → paletleme → transfer → satış → sayım işleminden sonra `SUM(stok_birimleri.miktar) == urun_varyantlari.miktar`. Bu tek test, DEV-11 ve Y-02 sınıfının tamamını yakalar.
2. **Eşzamanlılık:** aynı siparişe `Promise.all([teslimAl, teslimAl])`; tam olarak birinin başarılı olması beklenir. F-03/F-04'ün regresyonunu kalıcı olarak engeller.
3. **Deadlock:** aynı varyant üzerinde paralel `giris` + `cikis`; Y-01'i doğrular veya çürütür.
4. **Yetkilendirme:** route tablosundan otomatik üretilen "token'sız istek 401 dönmeli" testi. F-02'nin regresyonunu engeller.
5. **Birim dönüşümü:** kg ↔ adet (`SatisSiparisleri.jsx:84-105`, `Sayim.jsx:97-103`, `StokHareketleri.jsx:109-113`). Üç yerde ayrı ayrı yazılmış, para ve stok hesabına doğrudan giren mantık, hiç test edilmemiş.

---

### DEV-23 — Servis katmanı yok · **Öncelik: Medium**

**Problem:** F-23 açık. Katmanlar hâlâ `routes/ → controllers/ → mysql2 pool`. Veri erişim katmanı yok, ham SQL controller'lara gömülü.

**Bulunduğu dosya:** `backend/controllers/` tamamı

**Neden hâlâ problem:** Somut sonuçları bu raporda sayılabilir hale gelmiş durumda:

- **"Stok ekle" mantığı üç yerde ayrı yazılmış:** `stokHareketiController.js:150-162`, `transferController.js:160-166`, `satinalmaController.js:223-230`. Üçü de `INSERT ... ON DUPLICATE KEY UPDATE` yapıyor ama üçü farklı: biri `miktar = miktar + ?`, biri `AS yeni ... yeni.miktar` sözdizimi (MySQL 8.0.20+), biri tek satır. Bir düzeltme üç yere uygulanmayı gerektiriyor.
- **"Stok düş + hareket kaydet" mantığı üç yerde:** `stokHareketiController.js:198-235`, `satisController.js:271-309`, `sayimController.js:145-208`. `satisController` toplu değil, `satinalmaController` toplu — DEV-18'in kök nedeni tam olarak bu.
- **Kilit sırası tutarsızlığı (Y-01) doğrudan bu maddeden doğuyor:** tek bir `stokEkle(conn, {...})` / `stokDus(conn, {...})` fonksiyonu olsaydı, tablo sırası tek yerde belirlenir ve tutarsızlık **imkânsız** olurdu.
- **Transaction boilerplate'i 11 yerde tekrarlanmış** (F-16'da listelendi). Bugün 11'i de doğru; 12.'nin doğru olacağının garantisi yok.
- İş mantığı HTTP'ye bağlı olduğu için test edilemiyor (DEV-22) ve ileride bir iş kuyruğundan veya CLI'dan çağrılamıyor.

**Etkisi:** Doğrudan bir hata değil, **hata üretme hızı**. Bu denetimdeki yeni bulguların en az üçü (Y-01, DEV-18, Y-03) tek bir servis katmanı olsaydı doğmazdı.

**Nasıl düzeltilmeli:** Aşamalı, tek seferde değil:
1. `backend/db/withTransaction.js` — sarmalayıcı. F-16'nın boilerplate'ini de tek yere indirir, `ER_LOCK_DEADLOCK` retry'ı da buraya girer (F-12'nin kalanı).
2. `backend/services/stokServisi.js` — `stokEkle(conn, {...})`, `stokDus(conn, {...})`, `hareketYaz(conn, {...})`. **Tablo kilit sırası burada sabitlenir** ve Y-01 yapısal olarak kapanır.
3. Controller'lar yalnızca: gövdeyi doğrula → servisi çağır → yanıt biçimlendir.

---

### DEV-24 — Token `localStorage`'da · **Öncelik: Medium**

**Problem:** F-24 kısmen kapandı. `token_surumu` ile şifre değişiminde tüm oturumlar düşüyor — bu gerçek bir kazanım. Ama token hâlâ `localStorage`'da.

**Bulunduğu dosya:** `frontend/src/pages/Giris.jsx:39`, `frontend/src/api/axios.js:14`, `frontend/src/components/Sidebar.jsx:107`

**Neden hâlâ problem:** `localStorage`'daki token JavaScript'ten okunabilir; herhangi bir XSS açığı doğrudan tam hesap ele geçirmeye dönüşür. Kodda XSS vektörü **bulunamadı** (`dangerouslySetInnerHTML` yok, `eval` yok, `innerHTML` yok — doğrulandı), yani bu mevcut bir açık değil, bir **etki büyütücü**. Ancak `lucide-react`, `recharts`, `axios` gibi bağımlılıklardan gelecek bir tedarik zinciri sorunu bu riski gerçeğe çevirir.

Daha somut nokta: "Çıkış yap" (`Sidebar.jsx:116-120`) yalnızca `localStorage`'ı temizliyor — token hâlâ sunucu tarafında geçerli. Kopyalanmışsa (ör. ortak kullanılan bir el terminalinden) 8 saat daha kullanılabilir.

**Etkisi:** Düşük olasılık, yüksek etki.

**Nasıl düzeltilmeli:** Kısa vadede token ömrünü 8 saatten 1-2 saate indir ve DEV-06'daki DB kontrolünü ekle — böylece iptal fiilen mümkün olur. Orta vadede `httpOnly; Secure; SameSite=Strict` cookie + kısa ömürlü access token + refresh token. Cookie'ye geçilirse CSRF koruması zorunlu hale gelir; şu anki `Authorization` header yaklaşımında CSRF riski **yok** ve bu bilinçli bir denge — geçiş bu dengeyi bozacağı için aceleye getirilmemeli.

Not: `Sidebar.jsx:107` ve `LokasyonYonetimi.jsx:49`, `Kullaniciler.jsx:10` menü/sayfa gösterimini `localStorage`'daki `kullanici.rol` üzerinden yapıyor. Kullanıcı bunu elle değiştirip admin menüsünü görebilir — backend `izinVer` kontrolünü yaptığı için **güvenlik açığı değil**, ama kafa karıştırıcı 403'lere yol açar (bkz. Y-47).

---

### DEV-29 — Şema tabanlı girdi doğrulama yok · **Öncelik: Medium**

**Problem:** F-29 açık. Doğrulama her controller'da elle ve **tutarsız**.

**Bulunduğu dosya ve kanıt:**

İyi yazılmış örnekler (doğrulama var, tutarlı):
- `satisController.js:62-79` — kalem başına `varyant_id`, `Number.isFinite(miktar) && miktar > 0`, `fiyat >= 0`
- `sayimController.js:25-55` — tip kontrolü, tekrar kontrolü, negatif kontrolü
- `stockUnitController.js:100-113` — kod uzunluğu, tamsayı kontrolü

Hiç doğrulama olmayan örnekler:
- `varyantController.js:128-155` (`guncelle`) — **hiçbir alan doğrulanmıyor**. İstemci `boy` göndermezse `undefined` bind edilir → mysql2 `"Bind parameters must not contain undefined"` fırlatır → 500. Bu, F-20'de kapatılan hatanın **birebir aynısının başka bir dosyada devam etmesi**.
- `varyantController.js:101-115` (`ekle`) — `miktar`, `kritik_seviye`, `birim_fiyat`, `ambalaj_kg` hiç doğrulanmıyor; `miktar || 0` ile negatif değer bile kabul edilir.
- `lokasyonController.js:113-130` (`guncelle`) — `parseInt(satir, 10)` NaN olabilir; `satir` `NOT NULL` olduğu için 500.
- `tedarikciController.js:44-56` (`guncelle`) — `ad` zorunluluğu **yok**, `affectedRows` kontrolü **yok** → var olmayan id için bile "Güncellendi" dönüyor.
- `stokHareketiController.js:35-43` — `baslangic`/`bitis` biçimi doğrulanmıyor; `raporController` bunun için `gecerliGunMu` yazmış ama bu uçta kullanılmamış.

**Etkisi:** Kullanıcı anlamsız 500'ler görüyor (üretimde "Sunucu hatası", geliştirmede ham MySQL mesajı). Aynı kavram için beş farklı doğrulama üslubu var; hangi ucun neyi kabul ettiği ancak kod okunarak anlaşılıyor. `toplam_tutar` sunucuda yeniden hesaplanmadığı için (bkz. F-05 notu) istemciden gelen fiyata güveniliyor.

**Nasıl düzeltilmeli:** `zod` ile uç başına şema + `dogrulaGovde(sema)` middleware'i. Doğrulama kodu yarıya iner, hata mesajları tutarlı hale gelir, 500'lerin çoğu anlamlı 400'lere döner. Ek kazanç: şemadan tip türetilebilir, yani TypeScript'e geçmeden tip güvenliğinin önemli bir kısmı elde edilir (F-31'in TS maddesine ucuz alternatif). `toplam_tutar` **sunucuda** varyantın kayıtlı fiyatından hesaplanmalı.

---

### DEV-30 — Gözlemlenebilirlik ve operasyon · **Öncelik: Medium**

**Problem:** F-30 kısmen kapandı. `/saglik` (liveness) ve `/sistem/kontroller` (veri bütünlüğü) eklendi — ikisi de gerçek kazanım. Ama üretim operasyonu için gerekenler yok.

**Bulunduğu dosya:** `backend/index.js` (37 satır, tamamı okundu)

**Eksik olanlar:**
- **Graceful shutdown yok.** `process.on("SIGTERM")` yok, `server.close()` yok, `pool.end()` yok. Deploy sırasında süreç öldürüldüğünde transaction ortasındaki istekler kesilir ve MySQL zaman aşımına bırakılır. `AUDIT.md:1028` bunu "yirmi satır" diye tanımlamış, hâlâ yazılmamış.
- **Yapılandırılmış log yok.** Tek loglama `console.error` (`hataYonetici.js:6`). İstek logu yok, `requestId` korelasyonu yok. Kullanıcı "Sunucu hatası" gördüğünde o hatayı loglarda bulmanın yolu yok.
- **İş olayı logu yok.** Teslim alma, teslim etme, sayım farkı, tutarsızlık tespiti gibi kritik olaylar hiçbir yere yazılmıyor. Sessiz veri bütünlüğü hataları ancak bu loglarla yakalanabilir.
- **`trust proxy` ayarı yok** — rate limiting'i reverse proxy arkasında bozar (F-07 notu).
- **Metrik / hata takibi yok.**

**Olumlu not (doğrulandı):** `stok_hareketleri` tablosu `olusturan_kullanici_id` ve `tarih` tutuyor ve **tüm** stok mutasyon yolları bunu dolduruyor — `stokHareketiController.js:141`, `satisController.js:306`, `satinalmaController.js:239`, `sayimController.js:135`. Stok için denetim izi gerçekten var ve iyi tasarlanmış.

**Ama denetim izinde iki delik var:** transferler `stok_hareketleri`'ne **yazmıyor** (yalnızca `transferler` tablosuna — `transferController.js:174-179`) ve paletleme hiçbir yere yazmıyor (`stockUnitController.js:156-166`). Yani hareket defterinden lokasyon bazlı stok yeniden hesaplanamıyor. Ayrıntı için Y-05 ve Y-06.

Ayrıca denetim izi olmayan alanlar: fiyat değişiklikleri, kullanıcı rol değişiklikleri, lokasyon silme, giriş denemeleri.

**Nasıl düzeltilmeli:** `pino` ile JSON log + `requestId` middleware'i; `process.on("SIGTERM")` → `server.close()` → `pool.end()`; `app.set("trust proxy", 1)`; kritik iş olayları için ayrı bir log seviyesi.

---

### DEV-31 — Frontend kod kalitesi · **Öncelik: Medium — hiçbir alt maddesi kapanmamış**

`AUDIT.md:886-895`'teki altı alt maddenin **tamamı** hâlâ açık ve bu denetimde ölçüldü:

| Alt madde | Durum | Kanıt |
|---|---|---|
| **Yutulan hatalar** | ❌ Açık, **taşınmış** | Orijinal `StokHareketleri.jsx:95` düzeltilmiş görünüyor ama aynı kalıp yeni yerlerde: `StokHareketleri.jsx:98` (`.catch(() => setBirimler([]))` → "Bu varyantın stoğu yok" yazıyor) ve `DepoHaritasi.jsx:65-67` (`catch { setSeciliStok([]) }` → "Bu lokasyonda stok yok" yazıyor). Ağ hatası ile boş sonuç hâlâ ayırt edilmiyor. |
| **1850 satırlık tek CSS** | ❌ Açık | `frontend/src/index.css` = 1850 satır (ölçüldü). Bölünmemiş. |
| **Büyük bileşenler** | ❌ Açık, **büyümüş** | `LokasyonYonetimi.jsx` 541 (önce 541), `Varyantlar.jsx` 537 (önce 528), `SatisSiparisleri.jsx` 529 (önce 472), `SatinalmaSiparisleri.jsx` 476 (önce 427), `StokHareketleri.jsx` 411, `DepoHaritasi.jsx` 404. Hiçbiri bölünmemiş, dördü büyümüş. `frontend/src/hooks/` dizini **yok**. |
| **Sanallaştırma yok** | ❌ Açık | Tüm tablolar ve `DepoHaritasi`'ndaki grid tamamen DOM'a basılıyor. |
| **Kod bölme yok** | ❌ Açık, **ölçüldü** | `App.jsx:3-22` 18 sayfayı statik import ediyor. `npm run build` → tek chunk **788.41 kB (gzip 229.70 kB)**. Vite'ın kendi uyarısı: "Some chunks are larger than 500 kB". |
| **Tip güvenliği yok** | ❌ Açık | TypeScript yok. `@types/react` yalnızca editör desteği için. |

**Yeni ölçüm — lint:** `npx eslint .` → **56 problem (48 hata, 8 uyarı)**, 18 dosyaya yayılmış:

| Kural | Adet |
|---|---|
| `no-unused-vars` (hepsi yakalanmış ama kullanılmayan `err`) | 26 |
| `react-hooks/set-state-in-effect` | 21 |
| `react-hooks/exhaustive-deps` | 8 |
| `react-refresh/only-export-components` | 1 |

`package.json:9`'da `"lint": "eslint ."` scripti **var** ama hiç yeşil olmamış. Bu, DEV-31'in en somut göstergesi: araç kurulu, kural seti makul, ama çıktısı yok sayılıyor.

---

### Bölüm 2 Özeti

| ID | Başlık | Öncelik | AUDIT ID |
|---|---|---|---|
| DEV-22 | Sıfır test | **High** | F-22 |
| DEV-11 | `urun_varyantlari.miktar` ayrı toplam | **High** | F-11 |
| DEV-06 | Rol/durum değişimi oturumu düşürmüyor | **High** | F-06 (kalan) |
| DEV-13 | Rezervasyon yok | **High** | F-13 |
| DEV-17 | Sayfalanmayan uçlar | Medium | F-17 |
| DEV-18 | Döngü içi sorgu | Medium | F-18 |
| DEV-21 | Migration yok | Medium | F-21 |
| DEV-23 | Servis katmanı yok | Medium | F-23 |
| DEV-24 | Token `localStorage`'da | Medium | F-24 |
| DEV-29 | Şema tabanlı doğrulama yok | Medium | F-29 |
| DEV-30 | Gözlemlenebilirlik | Medium | F-30 |
| DEV-15 | İdempotanlık yok | Medium | F-15 |
| DEV-31 | Frontend kod kalitesi (6 alt madde) | Medium | F-31 |

---

## 3. YENİ BULUNAN EKSİKLİKLER 🆕

`AUDIT.md`'de hiç bahsedilmeyen, bu denetimde tespit edilen bulgular. Backend (Y-01 – Y-26) ve frontend (Y-30 – Y-65) olarak ayrıldı.

---

### 3.1 Backend — Eşzamanlılık ve veri bütünlüğü

#### Y-01 — Tablolar arası kilit sırası tutarsız → deadlock · **Critical**

**Problem:** F-12 tablo **içi** kilit sırasını deterministik hale getirdi, ama tablolar **arası** sıra iki farklı yönde uygulanıyor. Aynı anda çalışan iki transaction birbirini kilitleyebiliyor.

**Bulunduğu dosya — kanıt:**

*Yön A — önce `urun_varyantlari`, sonra `stok_birimleri`:*
```
stokHareketiController.js:145-148   UPDATE urun_varyantlari SET miktar = miktar + ?
stokHareketiController.js:150-162   INSERT stok_birimleri ... ON DUPLICATE KEY UPDATE
```
```
satinalmaController.js:208-213      UPDATE urun_varyantlari SET miktar = miktar + CASE...
satinalmaController.js:223-230      INSERT stok_birimleri ... ON DUPLICATE KEY UPDATE
```

*Yön B — önce `stok_birimleri`, sonra `urun_varyantlari`:*
```
stokHareketiController.js:198-202   UPDATE stok_birimleri SET miktar = miktar - ?
stokHareketiController.js:216-219   UPDATE urun_varyantlari SET miktar = miktar - ?
```
```
satisController.js:274-278          UPDATE stok_birimleri SET miktar = miktar - ?
satisController.js:292-295          UPDATE urun_varyantlari SET miktar = miktar - ?
```
```
sayimController.js:153-156          UPDATE stok_birimleri SET miktar = ?
sayimController.js:139-142          UPDATE urun_varyantlari SET miktar = miktar + ?   (hareketYaz içinde)
```

**Neden problem:** Deadlock'tan kaçınmanın temel kuralı, tüm transaction'ların kilitleri aynı deterministik sırada almasıdır. Burada **giriş yolları A yönünde, çıkış yolları B yönünde** kilit alıyor. Somut senaryo:

1. İşlem A (`POST /stok-hareketleri`, tip=`giris`, varyant 7): `urun_varyantlari` satır 7 üzerinde X kilidi alır. Ardından `stok_birimleri` satırını güncellemeye çalışır.
2. İşlem B (`PATCH /satis-siparisleri/5/teslim-et`, aynı varyant 7'nin bir paletinden): `stok_birimleri` o satırında X kilidi alır. Ardından `urun_varyantlari` satır 7'yi güncellemeye çalışır.
3. A, B'nin tuttuğu `stok_birimleri` satırını bekler. B, A'nın tuttuğu `urun_varyantlari` satırını bekler. → **Deadlock.**

Aynı çakışma `satinalmaController.teslimAl` (yön A) ile `satisController.teslimEt` (yön B) arasında, ve `sayimController` ile giriş yolları arasında da mevcut.

**Etkisi:** InnoDB deadlock'u tespit edip transaction'lardan birini geri alır (`ER_LOCK_DEADLOCK`), yani **veri bozulmaz** — bu iyi haber. Kötü haber: kullanıcı sebepsiz bir hata görür. `hataYonetici` bu hatayı özel olarak ele almadığı için üretimde "Sunucu hatası", geliştirmede ham MySQL mesajı döner. Yoğun saatte (mal kabul + sevkiyat aynı anda, ki bir depoda normaldir) işlemler rastgele başarısız olur ve kullanıcı neden olduğunu anlayamaz. Ayrıca `ER_LOCK_DEADLOCK` için retry olmadığı için işlemi elle tekrarlamak zorunda kalır.

Olasılığı artıran etken: DEV-18'deki döngü içi sorgular kilit tutma süresini uzatıyor. 20 paletlik bir teslimatta `stok_birimleri` kilitleri 80 sorgu boyunca tutuluyor.

**Nasıl düzeltilmeli:**
- **Kalıcı çözüm:** DEV-23'teki `stokServisi` katmanı. Tüm stok mutasyonları tek fonksiyondan geçtiğinde tablo sırası tek yerde sabitlenir ve bu hata sınıfı **yapısal olarak imkânsız** hale gelir.
- **Bugün yapılabilecek:** Bir kural belirle ve beş yolda da uygula — örneğin **her zaman önce `urun_varyantlari`, sonra `stok_birimleri`**. Çıkış yollarında `urun_varyantlari` güncellemesini `stok_birimleri` güncellemesinin **öncesine** almak yeterli; miktar zaten okunmuş durumda olduğu için mantık değişmiyor.
- **Tamamlayıcı:** `ER_LOCK_DEADLOCK` için 3 denemelik üstel bekleme retry'ı (F-12'nin uygulanmamış 3. maddesi).

**Öncelik gerekçesi:** Critical, çünkü üretimde eşzamanlı kullanımda kaçınılmaz olarak tetiklenir, teşhisi zordur ve kullanıcıya anlamsız bir hata olarak yansır. Veri bozulmadığı için "Critical" sınıfının alt ucunda — ama F-12'nin kapatıldığı sanılan bir riskin başka bir kılıkta devam etmesi, önceliği yukarı çekiyor.

---

#### Y-02 — `varyantController.ekle` hayali stok üretiyor · **Critical**

**Problem:** Varyant oluştururken `miktar` alanı doğrudan kabul ediliyor. Bu stok hiçbir `stok_birimleri` satırına ve hiçbir `stok_hareketleri` kaydına bağlanmıyor.

**Bulunduğu dosya:**
- `backend/controllers/varyantController.js:101-115` — `INSERT INTO urun_varyantlari (..., miktar, ...) VALUES (..., ?, ...)` ile `miktar || 0`
- `frontend/src/pages/Varyantlar.jsx:256-274` — "Başlangıç stoğu" alanı, adet/kg birim seçici ile birlikte kullanıcıya sunuluyor
- `frontend/src/pages/Varyantlar.jsx:132` — `miktar: miktarAdet` olarak gönderiliyor

**Neden problem:** Bu, DEV-11'deki sapmayı üreten **bilinen tek yol** ve arayüzde açıkça sunuluyor. 100 adet başlangıç stoğuyla bir varyant oluşturulduğunda:
- `urun_varyantlari.miktar` = 100
- `SUM(stok_birimleri.miktar)` = 0
- `stok_hareketleri` = boş

`AUDIT.md:863` bunu F-29 altında bir alt madde olarak not etmiş ("doğuştan drift") ama düzeltilmemiş ve bulgu tablosunda bağımsız bir madde olarak yer almamış. Bu denetimde bağımsız ve **Critical** olarak sınıflandırılıyor, çünkü:

**Etkisi — sistem kendi kendisiyle çelişiyor:**
1. Kullanıcı `Varyantlar` ekranından 100 adetlik bir varyant oluşturur.
2. `SystemHealth` ekranı bunu anında **"Stok Sapması · seviye: kritik"** olarak raporlar (`healthController.js:70-84`).
3. `LokasyonYonetimi` ekranı "1 varyantta tutarsızlık var" uyarısı gösterir (`LokasyonYonetimi.jsx:191`).
4. Bu 100 adet hiçbir lokasyonda görünmez, `PickingModal` onu bulamaz, satılamaz.
5. Panel ve `dusukStok` bu 100 adedi gerçek stok sayar — satın alma kararı yanlış veriyle verilir.
6. `LokasyonYonetimi.jsx:193` "Sayım yaparak düzeltebilirsiniz" diyor, ama sayım lokasyon bazlı çalıştığı için (`sayimController.js:59-76`) hiçbir lokasyona bağlı olmayan bu stok **sayımla düzeltilemez**. Kullanıcı çıkışsız bir döngüde kalır.

**Nasıl düzeltilmeli:** İki seçenek, ikisi de küçük:
- **A (tercih, en ucuz):** `varyantController.ekle`'den `miktar` alanını kaldır; her zaman 0 ile yarat. Arayüzden "Başlangıç stoğu" alanını kaldır ve kullanıcıyı `StokHareketleri` → Giriş akışına yönlendir. Katalog tanımı ile stok girişi kavramsal olarak farklı işlerdir; birleştirilmeleri zaten yanlıştı.
- **B:** `ekle`'yi transaction'a al; `miktar > 0` ise zorunlu bir `lokasyon_id` iste, `stok_birimleri` satırı yaz ve `stok_hareketleri`'ne `giris`/`manuel` kaydı düş. Kullanıcı kolaylığı korunur ama controller karmaşıklaşır.

A seçeneği tercih edilmeli: DEV-11'deki kolon kaldırılana kadar sapmayı üretebilen yolu kapatır ve bunu tek satırlık bir değişiklikle yapar.

---

#### Y-03 — Negatif stok koruması eksik ve şemada kısıt yok · **Medium**

**Problem:** `stok_birimleri` düşümleri koşullu (`AND miktar >= ?`) ama `urun_varyantlari.miktar` düşümleri koşulsuz. Şemada hiçbir `CHECK` kısıtı yok.

**Bulunduğu dosya:**
```
satisController.js:292-295      UPDATE urun_varyantlari SET miktar = miktar - ? WHERE id = ?
stokHareketiController.js:216-219  UPDATE urun_varyantlari SET miktar = miktar - ? WHERE id = ?
sayimController.js:139-142      UPDATE urun_varyantlari SET miktar = miktar + ? WHERE id = ?   (fark negatif olabilir)
```
`backend/db/schema.sql` — 267 satırın tamamı tarandı, **tek bir `CHECK` kısıtı yok**. `urun_varyantlari.miktar` (satır 234), `stok_birimleri.miktar` (satır 151), `transferler.miktar` (satır 209), `stok_hareketleri.miktar` (satır 172) — hepsi `decimal ... NOT NULL DEFAULT '0.00'`, alt sınır yok.

**Neden problem:** Bugün `stok_birimleri` tarafındaki koruma sayesinde normal akışta negatife düşülmez. Ama Y-02 ile üretilen bir sapma varken (`urun_varyantlari.miktar` = 100, birimler = 0) ilk gerçek çıkış işlemi `urun_varyantlari.miktar`'ı düşürür ve toplam yanlış yönde ilerler. Daha kötüsü: sapma **ters yönde** olduğunda (birimlerde 50, toplamda 0) bir çıkış `urun_varyantlari.miktar`'ı **-50** yapar. `healthController.js:16-30` bu durumu tespit etmek için özel bir sorgu içeriyor — yani mümkün olduğu biliniyor ama önlenmiyor.

**Etkisi:** Negatif stok fiziksel olarak imkânsız bir durumdur; ortaya çıktığında hangi işlemin sebep olduğunu bulmak neredeyse imkânsızdır. `SystemHealth` bunu "kritik" olarak raporluyor ama düzeltme yolu sunmuyor.

**Nasıl düzeltilmeli:**
1. Şemaya `CHECK (miktar >= 0)` ekle — `stok_birimleri`, `urun_varyantlari`, `transferler`, `stok_hareketleri`. MySQL 8.0.16+ bunu zorunlu kılar (mevcut şema `utf8mb4_0900_ai_ci` collation kullanıyor, yani MySQL 8.0+; kısıt çalışacaktır). Bu, uygulamada bir hata olsa bile veritabanının son savunma hattı olmasını sağlar.
2. `urun_varyantlari` düşümlerini de koşullu yap (`AND miktar >= ?`) ve `affectedRows === 0` durumunu hata olarak ele al — `stok_birimleri` tarafında zaten yapılan şey.
3. Kalıcı çözüm yine DEV-11: kolon kaldırılırsa bu madde tamamen ortadan kalkar.

---

#### Y-04 — `transferController` transaction dışında okuma yapıyor · **Medium**

**Problem:** Transfer edilecek birim, `beginTransaction()` çağrısından **önce** okunuyor.

**Bulunduğu dosya:** `backend/controllers/transferController.js:52-71`
```
const [birimRows] = await connection.query(          // ← autocommit, kilitsiz
  `SELECT id, tip, kod, varyant_id, lokasyon_id, miktar FROM stok_birimleri WHERE id = ?`, [birimId],
);
...
const kaynakId = Number(birim.lokasyon_id);
if (kaynakId === hedefId) { ... }                    // ← eski veriye dayalı karar
await connection.beginTransaction();                 // ← transaction ANCAK burada başlıyor
```

**Neden problem:** F-03/F-04'te düzeltilen desenin **birebir aynısı**, farklı bir controller'da. Palet yolunda satır transaction içinde `FOR UPDATE` ile yeniden okunuyor (satır 86-89), yani asıl işlem korumalı — bu iyi. Ama `kaynakId` ve `birim.varyant_id` transaction dışındaki okumadan geliyor ve şunlar için kullanılıyor:
- `kaynakId === hedefId` kontrolü (satır 65-69)
- Dökme yolunda `WHERE tip='dokme' AND varyant_id = ? AND lokasyon_id = ?` koşulları (satır 122-144)
- `transferler` tablosuna yazılan `kaynak_lokasyon_id` (satır 178)

Palet, iki okuma arasında başka bir kullanıcı tarafından taşınmışsa: `kilitli[0].lokasyon_id` yeni lokasyonu gösterir ama `UPDATE ... WHERE id = ? AND lokasyon_id = ?` eski `kaynakId` ile çalıştığı için `affectedRows = 0` döner → 409 "Palet bu sırada taşınmış". Yani **sonuç doğru**, ama gereksiz bir tur atılıyor ve `transferler` kaydına yanlış kaynak yazılma riski dökme yolunda mevcut (dökme yolunda `kilitli` okuması yok, doğrudan `kaynakId` kullanılıyor).

**Etkisi:** Düşük olasılıklı ama gerçek: dökme transferinde kaynak lokasyon yanlış kaydedilebilir, `kaynakId === hedefId` kontrolü atlanabilir. Asıl önemi tutarlılık: proje F-03/F-04'te bu deseni bilinçli olarak düzeltti, burada aynı desen gözden kaçmış.

**Nasıl düzeltilmeli:** `beginTransaction()`'ı en başa al, ilk `SELECT`'i `FOR UPDATE` ile transaction içine taşı. Palet yolundaki ikinci okuma o zaman gereksizleşir ve kod da kısalır.

---

#### Y-05 — Transferler hareket defterine yazılmıyor · **Medium**

**Problem:** `POST /transferler` yalnızca `transferler` tablosuna yazıyor; `stok_hareketleri`'ne hiçbir kayıt düşmüyor.

**Bulunduğu dosya:** `backend/controllers/transferController.js:174-179` — tek `INSERT INTO transferler`. `stok_hareketleri` bu fonksiyonda hiç geçmiyor (dosyanın tamamı okundu).

**Neden problem:** `stok_hareketleri` projede denetim izi ve tarihsel kayıt olarak konumlanmış: `sebep` enum'unda `satinalma`, `satis`, `sayim`, `fire`, `iade`, `manuel` var (`schema.sql:177`), `lokasyon_id` kolonu var (satır 178) ve tüm diğer stok mutasyonları oraya yazıyor. Transfer bu resimden **eksik**.

Sonuç: bir lokasyonun stoğu hareket defterinden yeniden hesaplanamıyor. `SELECT SUM(CASE tip WHEN 'giris' THEN miktar ELSE -miktar END) FROM stok_hareketleri WHERE lokasyon_id = X` sorgusu, o lokasyona/lokasyondan yapılmış transferleri göremediği için gerçek stokla uyuşmaz.

**Etkisi:** Bir tutarsızlık tespit edildiğinde "bu mal buraya nasıl geldi / nereye gitti" sorusu iki ayrı tabloya bakılarak, üstelik farklı şemalarla cevaplanmak zorunda. `StokHareketleri` ekranı (kullanıcının "geçmiş" diye baktığı yer) transferleri **hiç göstermiyor** — kullanıcı açısından transfer, geçmişte hiç olmamış gibi görünüyor. Transfer geçmişi için ayrı bir ekran da yok (bkz. Y-50), yani transferler arayüzde hiçbir yerde listelenmiyor.

**Nasıl düzeltilmeli:** İki seçenek:
- **A:** Transferi iki `stok_hareketleri` kaydı olarak yaz (kaynaktan `cikis`, hedefe `giris`, `sebep='transfer'` — enum'a yeni değer). `transferler` tablosu üst düzey kayıt olarak kalır. Hareket defteri tam olur.
- **B:** `stok_hareketleri`'ne `hedef_lokasyon_id` ekleyip `tip='transfer'` olarak tek kayıt yaz. Şema değişikliği daha büyük.

A tercih edilmeli: mevcut sorguların hiçbirini bozmaz, `StokHareketleri` ekranı transferleri otomatik göstermeye başlar.

---

#### Y-06 — Paletleme hareket defterine yazılmıyor · **Low**

**Problem:** `POST /stok-birimleri/paletle` dökme stoktan palet oluştururken hiçbir `stok_hareketleri` kaydı yazmıyor.

**Bulunduğu dosya:** `backend/controllers/stockUnitController.js:143-166` — dökme düşülüyor, palet `INSERT` ediliyor, hareket yazılmıyor.

**Neden problem:** Toplam stok değişmediği için (`urun_varyantlari.miktar` dokunulmuyor — doğru davranış) veri bütünlüğü açısından sorun yok. Ama fiziksel bir işlem gerçekleşmiş: mal istiflenmiş, bir palet kodu almış. Bu olayın kim tarafından, ne zaman yapıldığı `stok_birimleri.olusturan_kullanici_id` ve `olusturulma_tarihi`'nden (satır 152-153) çıkarılabiliyor — yani bilgi tamamen kayıp değil.

**Etkisi:** Düşük. Palet bozulduğunda (tümü satıldığında `DELETE`) o kaydın geçmişi kayboluyor — `stok_birimleri` satırı silindiği için palet hiç var olmamış gibi oluyor. Bir palet kodunun geçmişini sorgulamak (hangi maldan, ne zaman, kim tarafından oluşturuldu, nereye taşındı, ne zaman tüketildi) mümkün değil. Barkod okuyucu akışı yaygınlaştıkça bu bilgi değerli hale gelir.

**Nasıl düzeltilmeli:** `sebep` enum'una `paletleme` ekleyip iki kayıt (dökmeden `cikis`, paletе `giris`) yazmak aşırıya kaçar — miktar değişmediği için raporları bozar. Daha uygunu: ayrı bir `birim_olaylari` tablosu (`birim_id, olay, kullanici_id, tarih, detay`) veya `stok_birimleri` satırlarını silmek yerine `aktif=0` ile arşivlemek. Y-05 çözülürken birlikte ele alınabilir.

---

#### Y-07 — `varyantController.guncelle` ve `lokasyonController.guncelle` doğrulamasız · **Medium**

**Problem:** F-20'de `kullaniciController` için kapatılan hata sınıfı, iki controller'da aynen devam ediyor.

**Bulunduğu dosya:**
```js
// varyantController.js:141-155 — hiçbir alan doğrulanmıyor
UPDATE urun_varyantlari SET boy=?, ambalaj_tipi=?, ambalaj_kg=?, barkod=?, kritik_seviye=?, birim_fiyat=?, aktif=?
[boy, ambalaj_tipi, ambalaj_kg, barkod || null, kritik_seviye, birim_fiyat, aktif ?? true, id]
```
```js
// lokasyonController.js:113-130
parseInt(satir, 10),      // NaN olabilir
parseInt(kolon, 10),      // NaN olabilir
```

**Neden problem:** `varyantController.guncelle`'de `boy` gönderilmezse `undefined` bind edilir → mysql2 `"Bind parameters must not contain undefined"` fırlatır → `hataYonetici` → **500**. F-20'nin metni bunu birebir tarif ediyor. `lokasyonController.guncelle`'de `satir: "abc"` gönderilirse `parseInt` `NaN` üretir; `satir` `NOT NULL` olduğu için MySQL hata verir → 500.

Bugün arayüz her zaman tüm alanları gönderdiği için tetiklenmiyor — ama bu, doğruluğun **istemcinin nezaketine** bağlı olması demek. `PUT /varyantlar/:id` herhangi bir HTTP istemcisinden çağrılabilir.

**Etkisi:** Anlamsız 500'ler; geliştirme ortamında ham MySQL mesajı sızıyor. Ayrıca `PUT` semantiği kısmi güncellemeyi desteklemediği için, ileride bir "sadece fiyatı güncelle" akışı yazıldığında patlar.

**Nasıl düzeltilmeli:** Kısa vadede `kullaniciController.js:38-48`'deki beyaz listeli dinamik `SET` desenini kopyala — proje bunu zaten bir kez doğru yazmış. Kalıcı çözüm DEV-29 (`zod` şeması), ki o zaman üç yerde birden kapanır.

---

#### Y-08 — `varyantController.sil` eksik bağımlılık kontrolü · **Medium**

**Problem:** Silme öncesi yalnızca iki bağımlılık kontrol ediliyor; iki tanesi atlanmış.

**Bulunduğu dosya:** `backend/controllers/varyantController.js:172-209`
- Kontrol edilen: `stok_hareketleri` (satır 176-184), `satinalma_siparis_kalemleri` (satır 186-194)
- **Kontrol edilmeyen:** `satis_siparis_kalemleri`, `stok_birimleri`, `transferler`

**Neden problem:** Şemada bu üç tablonun da `urun_varyantlari`'na FK'si var (`schema.sql:121`, `163`, `218`). Kontrol edilmeyen bir bağımlılık varsa `DELETE` yabancı anahtar hatası verir ve kullanıcı, diğer iki durumda gördüğü nazik 409 mesajı yerine **500 "Sunucu hatası"** görür.

Somut senaryo: hiç hareketi olmayan ama üzerinde bir satış siparişi kalemi olan bir varyant → 500. Veya Y-02 ile oluşturulmuş, sonra bir lokasyona giriş yapılmış bir varyant → `stok_birimleri` FK'si → 500.

**Etkisi:** Tutarsız kullanıcı deneyimi ve gereksiz 500. Aynı fonksiyonun içinde iki kontrol düzgün yapılıp iki tanesinin atlanması, bunun bir bilgi eksikliği değil **gözden kaçma** olduğunu gösteriyor — kontrol listesinin kod içine gömülmesinin doğal sonucu.

**Nasıl düzeltilmeli:** Eksik iki kontrolü ekle. Daha iyisi: `ER_ROW_IS_REFERENCED_2` hata kodunu `catch` içinde yakalayıp genel bir 409 dön — bu, gelecekte eklenecek yeni FK'lerde otomatik olarak doğru davranır ve kontrol listesinin şema ile senkron kalmasını gerektirmez. İkisini birlikte yapmak en sağlamı: spesifik mesajlar için ön kontroller, güvenlik ağı için hata kodu yakalama.

---

#### Y-09 — `tedarikciController` diğerlerinin gerisinde kalmış · **Medium**

**Problem:** Aynı işi yapan `musteriController` ile karşılaştırıldığında üç eksik var.

**Bulunduğu dosya:** `backend/controllers/tedarikciController.js:44-66`

| Kontrol | `musteriController` | `tedarikciController` |
|---|---|---|
| `guncelle`: `ad` zorunlu mu | ✅ satır 50-52 | ❌ Yok |
| `guncelle`: `affectedRows` kontrolü | ✅ satır 59-61 | ❌ Yok |
| `sil`: bağımlı sipariş kontrolü | ✅ satır 73-82 | ❌ Yok |
| `sil`: `affectedRows` kontrolü | ✅ satır 86-88 | ❌ Yok |

Ayrıca `guncelle`'de `const [result] = await pool.query(...)` — `result` hiç kullanılmıyor (satır 48), ölü değişken.

**Neden problem:**
- Var olmayan bir tedarikçiyi güncellemeye çalışmak **"Güncellendi" mesajı döndürüyor**. Kullanıcı işlemin başarılı olduğunu sanıyor; hiçbir şey olmadı.
- Var olmayan bir tedarikçiyi silmek **"Silindi" mesajı döndürüyor**.
- Siparişi olan bir tedarikçiyi silmek FK hatası → **500**, oysa müşteri tarafında aynı durum nazik bir 409 mesajı üretiyor: "Bu müşterinin 3 siparişi var, silinemez".
- `ad` boş gönderilebiliyor; `ad` `NOT NULL` olduğu için `null` gönderilirse 500, boş string gönderilirse **isimsiz tedarikçi** kaydı oluşuyor.

**Etkisi:** Sessiz başarısızlık en kötü hata türüdür — kullanıcı yanlış bir zihinsel modelle devam eder. `satinalmaController.listele` `JOIN tedarikciler` kullandığı için (satır 22), tedarikçi silinebilseydi tüm siparişleri listeden kaybolurdu; FK bunu engelliyor ama mesaj kullanıcıya anlaşılır biçimde ulaşmıyor.

**Nasıl düzeltilmeli:** `musteriController`'ı birebir kopyala. Bu dosya, DEV-23'ün (servis katmanı) neden gerekli olduğunun kanıtı: aynı CRUD deseni iki kez yazılmış ve ikisi zamanla ayrışmış.

---

#### Y-10 — `kategoriController.ekle` yinelenen kayıt hatasını yakalamıyor · **Low**

**Problem:** `kategoriler.ad` üzerinde `UNIQUE KEY` var (`schema.sql:19`) ama `ekle` `ER_DUP_ENTRY` yakalamıyor.

**Bulunduğu dosya:** `backend/controllers/kategoriController.js:47-62`

**Neden problem:** Var olan bir kategori adı girildiğinde 500 dönüyor. Aynı projede `authController.js:39-41`, `varyantController.js:119-123`, `lokasyonController.js:83-87` ve `stockUnitController.js:173-175` bu hatayı düzgün yakalayıp 409 + anlamlı mesaj dönüyor — yani desen biliniyor, burada uygulanmamış.

**Etkisi:** Düşük ama kullanıcıya doğrudan yansıyor: `Kategoriler.jsx:41` `err.response?.data?.hata || "Kategori eklenemedi"` gösteriyor, yani kullanıcı üretimde "Sunucu hatası" toast'ı görüyor ve nedenini anlamıyor.

**Nasıl düzeltilmeli:** Dört satırlık `catch` bloğu. Aynı taramada: `urunController.ekle` de `ER_DUP_ENTRY` yakalamıyor ama `urunler.ad` üzerinde UNIQUE yok, dolayısıyla sorun değil.

---

#### Y-11 — Sayım oturumu, kilidi ve geçmişi yok · **High (iş mantığı)**

**Problem:** Sayım işlemi tek atımlık bir düzeltme olarak modellenmiş; sayım diye bir varlık yok.

**Bulunduğu dosya:** `backend/controllers/sayimController.js` (tamamı), `backend/db/schema.sql` (sayım tablosu yok), `frontend/src/pages/Sayim.jsx`

**Üç ayrı eksik:**

**(a) Sayım kaydı yok.** Yapılan sayımlar yalnızca `stok_hareketleri`'nde `sebep='sayim'` olarak izleniyor (`sayimController.js:128`). "15 Temmuz'da L blokta yapılan sayımda kaç kalem sayıldı, kaçında fark çıktı, doğruluk oranı neydi" sorusu cevaplanamıyor. Aynı lokasyonda arka arkaya iki sayım yapıldığında ikisi birbirinden ayırt edilemiyor. `sayimlar (id, lokasyon_id, kullanici_id, baslangic, bitis, kalem_sayisi, farkli_kalem_sayisi, aciklama)` tablosu yok.

**(b) Sayım sırasında lokasyon kilitlenmiyor.** Kullanıcı sayım ekranını açıp fiziksel sayıma başladığında (dakikalar sürer), başka bir kullanıcı aynı lokasyondan satış toplaması yapabilir. Sayan kişi 100 sayar, kaydederken sistem 80'e düşmüştür → sayım, gerçekte doğru olan bir stoğu 100'e "düzeltir" ve **sapma yaratır**. `sayimController.js:69-76` yalnızca `kaydet` anında `FOR UPDATE` alıyor; okuma ile yazma arasındaki insan zamanı korunmuyor.

**(c) Kısmi sayım semantiği belirsiz.** `Sayim.jsx:105-107` yalnızca **değer girilmiş** satırları gönderiyor. Boş bırakılan satırlar sunucuya hiç ulaşmıyor ve dokunulmuyor. Bu, "seçili birimleri say" için doğru davranış — ama tam sayım için yanlış: fiziksel olarak kaybolmuş bir palet, kullanıcı o satıra 0 yazmayı unuttuğu sürece sistemde durmaya devam eder. Arayüzde "tam sayım / kısmi sayım" ayrımı yok, bu belirsizlik kullanıcıya hiç anlatılmıyor.

**Etkisi:** Sayım, stok doğruluğunun **son savunma hattı**. (b) maddesi bu hattı ters yönde çalıştırabiliyor — sayım, düzelttiğinden fazla sapma üretebilir. (a) maddesi sayımın kendisinin denetlenmesini imkânsız kılıyor; "geçen ay sayım yapıldı mı" sorusu ancak `stok_hareketleri` içinde `sebep='sayim'` filtresiyle, dolaylı olarak cevaplanabiliyor.

**Nasıl düzeltilmeli:**
1. `sayimlar` tablosu + `sayim_kalemleri` (sayılan birim, sistemdeki miktar, sayılan miktar, fark). Bu, aynı zamanda döngüsel sayım (cycle counting) yeteneğinin temeli.
2. Sayım başlatıldığında lokasyona bir "sayımda" bayrağı koy; o lokasyondan çıkış işlemlerini reddet veya uyar. Basit ve etkili: `lokasyonlar.sayim_kilidi_kullanici_id` + `sayim_kilidi_tarihi` (zaman aşımıyla).
3. Arayüzde "Tam sayım" seçeneği: işaretlendiğinde boş bırakılan satırlar 0 olarak gönderilir ve onay ekranında "3 birim sayılmadı, 0 olarak kaydedilecek" uyarısı gösterilir.

---

#### Y-12 — `hazirlaniyor` durumu ölü kod · **Low**

**Problem:** `satis_siparisleri.durum` enum'unda `hazirlaniyor` değeri var (`schema.sql:130`) ama backend'de **hiçbir yerde yazılmıyor** (tüm `backend/**/*.js` tarandı, tek eşleşme yok).

**Bulunduğu dosya:** `backend/db/schema.sql:130`, `frontend/src/components/Etiket.jsx:17,42` (renk ve metin tanımlı ama asla kullanılmıyor)

**Neden problem:** Şema bir iş akışı vaat ediyor (beklemede → hazırlanıyor → teslim edildi) ama akış yok. Ayrıca gizli bir tuzak: `satisController.js:314` durum güncellemesini `WHERE id = ? AND durum = 'beklemede'` ile yapıyor, yani `hazirlaniyor` durumundaki bir sipariş **teslim edilemez** (409 döner). Buna karşılık `SatisSiparisleri.jsx:390` "Teslim Et" butonunu `durum !== 'teslim_edildi' && durum !== 'iptal'` koşuluyla gösteriyor — yani butonun görünür olduğu ama çalışmadığı bir durum tanımlı. Bugün tetiklenmiyor çünkü durum hiç yazılmıyor; ilk yazıldığı gün patlayacak.

**Etkisi:** Bugün sıfır. Yarın, bu özellik eklendiğinde teşhisi zor bir hata.

**Nasıl düzeltilmeli:** İki seçenek — ya özelliği tamamla (`AUDIT.md:1032`'nin önerdiği gibi "Hazırlamaya Başla" / "Geri Al" butonları, ki hangi siparişin toplanmakta olduğunu görünür kılar), ya da enum değerini şemadan kaldır. Yarım bırakılmış üçüncü bir seçenek yok. Tamamlanacaksa `satisController.js:314` koşulu `durum IN ('beklemede','hazirlaniyor')` olmalı.

---

#### Y-13 — Satınalma siparişi iptal edilemiyor ve kısmi teslim alınamıyor · **High (iş mantığı)**

**Problem:** İki temel satınalma yeteneği eksik.

**Bulunduğu dosya:** `backend/routes/satinalmaRoutes.js` (4 uç: listele, detay, olustur, teslimAl), `backend/controllers/satinalmaController.js` (`iptalEt` fonksiyonu yok)

**(a) İptal yok.** `satis_siparisleri` için `PATCH /:id/iptal` var (`satisRoutes.js:10`), satınalma için yok. Şemada `satinalma_siparisleri.durum` enum'unda `'iptal'` değeri **mevcut** (`schema.sql:96`) ve `listele`'deki `bekleyen=1` filtresi bu değeri kullanıyor (`satinalmaController.js:10`) — yani tasarımda var, uygulamada yok.

Sonuç: yanlışlıkla açılan bir alım siparişi **hiçbir zaman kapatılamıyor**. Ne iptal edilebiliyor, ne silinebiliyor, ne düzenlenebiliyor. Sonsuza kadar "beklemede" listesinde duruyor ve panel "Bekleyen Sipariş" sayacını (`Panel.jsx:65`) kalıcı olarak şişiriyor. Kullanıcının tek çıkışı, gerçekte gelmeyen malı "teslim aldım" diye işaretlemek — ki bu **doğrudan hayali stok üretir**. Yani eksik bir özellik, kullanıcıyı veri bozmaya iten bir tasarıma dönüşmüş.

**(b) Kısmi teslim alma yok.** `teslimAl` (`satinalmaController.js:135-272`) siparişin **tüm** kalemlerini, **tam** miktarıyla, **tek** bir lokasyona indiriyor. Gerçek hayatta:
- Tedarikçi 100 kova sipariş edilen malın 60'ını gönderir → sistemde ya 100 girer (hayali stok) ya hiç girmez.
- Farklı kalemler farklı zamanlarda gelir → hepsi bekler.
- Farklı kalemler farklı yerlere indirilir (soğuk oda / normal raf) → hepsi tek lokasyona iner, sonra elle transfer gerekir.

**Etkisi:** (a) veri bozulmasına iten bir çıkışsızlık; (b) her mal kabulünde ek elle iş. İkisi birlikte, satınalma modülünü "gerçek depoda kullanılabilir" olmaktan çıkarıyor.

**Nasıl düzeltilmeli:**
- (a) `satisController.iptalEt`'i kopyala: `UPDATE satinalma_siparisleri SET durum='iptal' WHERE id=? AND durum <> 'teslim_alindi'`. Yarım saatlik iş, mevcut kod aynen kullanılabilir.
- (b) `satinalma_siparis_kalemleri`'ne `teslim_alinan_miktar` kolonu ekle; `teslimAl` gövdesi kalem başına `{kalem_id, miktar, lokasyon_id}` alsın; tüm kalemler tamamlandığında durum `teslim_alindi`, kısmen ise `kismi_teslim` olsun. Orta ölçekli bir iş ama satınalma modülünün gerçek dünyaya uyması için gerekli.

---

#### Y-14 — Sayfalama mantığı üç ayrı yerde farklı yazılmış · **Low**

**Problem:** `utils/pagination.js` doğru yazılmış ama yalnızca dört controller kullanıyor; üç controller kendi versiyonunu yazmış.

**Bulunduğu dosya:** `stokHareketiController.js:66-71` (üst sınır 100), `transferController.js:7-9` (üst sınır 200), `varyantController.js:54-60` ve `urunController.js:39-47` (üst sınır **yok**)

**Neden problem:** DEV-17'de etkisi anlatıldı; burada kod kalitesi boyutu: aynı kavram için dört farklı davranış, hiçbiri belgelenmemiş. Bir API tüketicisinin `limit` parametresinin nasıl davranacağını bilmesinin yolu yok.

**Nasıl düzeltilmeli:** `buildPagination`'ı her yerde kullan; uç bazında farklı varsayılan gerekiyorsa fonksiyon zaten `varsayilanLimit` parametresi alıyor (satır 3) — tasarım doğru, kullanılmıyor.

---

#### Y-15 — `kapasite` alanının anlamı çelişkili · **Medium**

**Problem:** Aynı kolon üç yerde üç farklı anlamda kullanılıyor.

**Bulunduğu dosya:**
- `schema.sql:48` — `kapasite decimal(12,2)` → ondalıklı, yani **miktar** ima ediyor
- `frontend/src/pages/LokasyonYonetimi.jsx:314` — etiket: **"Kapasite (adet)"** → ürün adedi
- `backend/controllers/healthController.js:43-57` — `COUNT(*) AS palet_sayisi ... HAVING palet_sayisi > l.kapasite` → **palet sayısı**
- `frontend/src/pages/DepoHaritasi.jsx:20-24` — `oran = miktar / kapasite` → **ürün adedi**

**Neden problem:** Bir admin "Kapasite (adet)" etiketini görüp bir rafa 500 yazıyor (500 kova alır diye). `SystemHealth` ekranı ise o rafta 501 **palet** olduğunda uyaracak şekilde yazılmış — yani uyarı pratikte hiç tetiklenmiyor. Tersine, kapasiteyi palet sayısı olarak 2 giren bir admin için `DepoHaritasi` doluluk rengini `miktar/2` ile hesaplıyor ve 3 adet mal olduğunda rafı "aşım" olarak kırmızıya boyuyor.

**Etkisi:** İki özellik de sessizce yanlış çalışıyor. Kullanıcı hangisinin doğru olduğunu anlayamıyor çünkü ikisi de makul görünüyor. Kapasite yönetimi fiilen kullanılamaz durumda.

**Nasıl düzeltilmeli:** Karar ver ve tek anlama indir. Depo pratiğinde palet yerleri **palet sayısıyla**, dökme alanlar **miktar/hacimle** ölçülür — yani iki ayrı kavram gerçekten var. Doğru model: `kapasite_palet INT` (tip='palet' lokasyonlar için) ve `kapasite_miktar DECIMAL` (alan tipleri için), veya tek `kapasite` + `kapasite_birimi ENUM('palet','adet')`. Arayüz etiketi lokasyon tipine göre değişmeli.

---

#### Y-16 — Lokasyon düzenleme sessizce `aktif` bayrağını sıfırlıyor; pasife alma arayüzü yok · **Medium**

**Problem:** İki bağlantılı kusur.

**Bulunduğu dosya:**
```js
// lokasyonController.js:127 — aktif gönderilmezse TRUE varsayılıyor
aktif === undefined ? true : Boolean(aktif),
```
```js
// LokasyonYonetimi.jsx:23-32 — BOS_ALAN nesnesinde `aktif` alanı YOK
const BOS_ALAN = { kod, ad, tip, satir, kolon, satir_span, kolon_span, kapasite };
// LokasyonYonetimi.jsx:116-125 — duzenlemeyeBasla de `aktif` kopyalamıyor
```

**Neden problem:**
1. Arayüz `aktif` alanını hiç göndermiyor. Dolayısıyla **pasif bir lokasyonun adını değiştirmek onu sessizce yeniden aktifleştiriyor.** Kullanıcı bunu hiçbir yerde görmüyor — tabloda `aktif` sütunu bile yok (`LokasyonYonetimi.jsx:485-492`: Kod, Ad, Tip, Konum, Stok, İşlemler).
2. Arayüzde bir lokasyonu **pasife alma yolu hiç yok**. Oysa backend `aktif` alanını destekliyor, `stokHareketiController.js:122`, `satinalmaController.js:170`, `sayimController.js:60`, `transferController.js:74` hepsi `WHERE aktif = TRUE` filtreliyor, ve `healthController.js:32-41` "Pasif Lokasyonda Stok" diye bir kontrol çalıştırıyor.
3. Daha kötüsü: `lokasyonController.sil` bir lokasyon silinemediğinde kullanıcıya **"Pasife alabilirsiniz"** diyor (satır 174) — arayüzde var olmayan bir işlemi öneriyor. Kullanıcı çıkışsız kalıyor.

**Ayrıca yetkilendirme tutarsız:** `lokasyonRoutes.js:19` — `PUT /:id` yalnızca `dogrula` istiyor, `izinVer("admin")` **istemiyor**. Yani her depo sorumlusu lokasyon kodunu, tipini, kapasitesini değiştirebilir; ama silmek için admin gerekiyor (satır 20). Sayfa zaten yalnızca admin'e gösteriliyor (`LokasyonYonetimi.jsx:83-85`) ama bu istemci tarafı bir kontrol — API doğrudan çağrılabilir.

**Etkisi:** Pasife alma özelliği backend'de tamamen yazılmış ve dört yerde tüketiliyor, ama arayüzden erişilemiyor — yapılmış iş boşa gidiyor. Ayrıca düzenleme işlemi, kullanıcının niyet etmediği bir yan etki üretiyor (sessiz veri mutasyonu), ki bu en zor fark edilen hata türü.

**Nasıl düzeltilmeli:**
1. `BOS_ALAN`'a `aktif: true` ekle, `duzenlemeyeBasla`'da `aktif: l.aktif` kopyala, forma bir checkbox ve tabloya bir `Durum` sütunu ekle (`Etiket` bileşeni `aktif`/`pasif` değerlerini zaten destekliyor — `Etiket.jsx:9-10`).
2. Backend'de `aktif === undefined` durumunda **mevcut değeri koru** (`COALESCE(?, aktif)`), varsayılan olarak `true` atama.
3. `PUT /lokasyonlar/:id`'ye `izinVer("admin")` ekle.

---

#### Y-17 — `dogrula` middleware'i her istekte iki kez çalışıyor · **Medium (performans + kod kalitesi)**

**Problem:** F-02 düzeltmesi global `router.use(dogrula)` ekledi ama alt router'lardaki eski `dogrula` çağrıları temizlenmedi.

**Bulunduğu dosya:** `backend/routes/index.js:7` (global) + aşağıdaki route dosyaları:

| Dosya | Fazladan `dogrula` sayısı |
|---|---|
| `lokasyonRoutes.js` | 4 (satır 9, 16, 17, 18, 22) |
| `musteriRoutes.js`, `tedarikciRoutes.js`, `urunRoutes.js`, `varyantRoutes.js`, `satisRoutes.js` | 3'er |
| `satinalmaRoutes.js`, `kategoriRoutes.js`, `transferRoutes.js` | 2'şer |
| `kullaniciRoutes.js`, `raporRoutes.js`, `sayimRoutes.js`, `stokHareketleriRoutes.js` | 1'er |

**Neden problem:** `dogrula` her çalıştığında bir JWT doğrulaması ve **bir veritabanı sorgusu** (`auth.js:23-26`) yapıyor. Yazma uçlarında bu sorgu iki kez çalışıyor; `lokasyonRoutes.js:9`'daki `tutarlilik` ucunda `dogrula` global + yerel = 2 kez, `izinVer` de 1 kez.

**Etkisi:** İstek başına 1 fazla DB round-trip. Tek başına küçük (indeksli PK sorgusu, ~0.3 ms), ama havuzda 20 bağlantı varken gereksiz yere %100 fazla auth sorgusu üretiliyor. Asıl maliyet okunabilirlik: route dosyalarına bakan biri hangi uçların korunduğunu anlamak için iki yere birden bakmak zorunda ve `stockUnitRoutes.js`, `dashboardRoutes.js`, `healthRoutes.js`, `passwordRoutes.js`'in `dogrula` içermemesi "korumasız mı?" sorusunu doğuruyor (değiller, global koruma altındalar).

**Nasıl düzeltilmeli:** Alt router'lardaki tüm `dogrula` referanslarını ve import'larını sil. `izinVer` çağrıları kalmalı — onlar gerçekten uç bazında. Bu tamamen mekanik, risksiz bir temizlik ve route dosyalarını belirgin biçimde kısaltır.

---

#### Y-18 — Şemada eksik indeksler · **Medium**

**Problem:** Sık filtrelenen ve sıralanan üç kolonda indeks yok.

**Bulunduğu dosya:** `backend/db/schema.sql`

| Eksik indeks | Kullanan sorgu |
|---|---|
| `stok_hareketleri(tarih)` | `raporController.js:35,48,62` (`WHERE tarih >= ? AND tarih < ?`), `dashboardController.js:11,22`, `stokHareketiController.js:62` (`ORDER BY sh.tarih DESC`) |
| `stok_hareketleri(varyant_id, tarih)` | `stokHareketiController.js:21` + `ORDER BY tarih` bileşik filtresi |
| `satis_siparisleri(siparis_tarihi)` | `satisController.js:21` (`ORDER BY s.siparis_tarihi DESC`) |
| `satinalma_siparisleri(siparis_tarihi)` | `satinalmaController.js:23`, `raporController.js:72` |

Mevcut indeksler (`schema.sql:180-182`) yalnızca FK'ler için: `olusturan_kullanici_id`, `varyant_id`, `lokasyon_id`.

**Neden problem:** `stok_hareketleri` monoton büyüyen bir tablo — bir WMS'te günde yüzlerce satır. `ORDER BY tarih DESC LIMIT 20` sorgusu indekssiz olduğunda MySQL tüm tabloyu okuyup sıralamak zorunda (`Using filesort`). `StokHareketleri` sayfası her açıldığında ve her filtre değişiminde bu sorgu çalışıyor. Panel grafikleri (`dashboardController.js`) her panel açılışında 14 günlük aralığı tarıyor — indekssiz tam tarama.

**Etkisi:** Bugün 44 satırla görünmez. 100.000 hareketde sayfa açılışı saniyelere çıkar ve Node.js tarafında JSON serileştirme senkron olduğu için **tüm eşzamanlı isteklere** yansır.

**Nasıl düzeltilmeli:** Dört `CREATE INDEX` ifadesi. `stok_hareketleri(varyant_id, tarih)` bileşiği hem tekil varyant filtresini hem tarih sıralamasını karşılar; `stok_hareketleri(tarih)` rapor/panel sorguları için ayrıca gerekli. Bunlar DEV-21'deki ilk migration dosyasının doğal içeriği.

---

#### Y-19 — Fiyat sunucuda doğrulanmıyor · **Medium**

**Problem:** Sipariş toplamı istemciden gelen `birim_fiyat` ile hesaplanıyor; varyantın kayıtlı fiyatıyla hiç karşılaştırılmıyor.

**Bulunduğu dosya:** `satisController.js:93-96`, `satinalmaController.js:95-98`
```js
const toplam_tutar = kalemler.reduce(
  (toplam, k) => toplam + Number(k.miktar) * Number(k.birim_fiyat), 0,
);
```
`urun_varyantlari.birim_fiyat` kolonu var (`schema.sql:236`) ve arayüz onu varsayılan olarak dolduruyor (`SatisSiparisleri.jsx:144-152`), ama sunucu hiç bakmıyor.

**Neden problem:** `birim_fiyat >= 0` kontrolü var (satır 76-78), yani negatif fiyat engellenmiş — bu iyi. Ama 0 kabul ediliyor ve üst sınır yok. Bir depo sorumlusu (veya arayüzü atlayan bir istek) 10.000 TL'lik bir malı 1 TL'ye satış siparişi olarak kaydedebilir; sistem hiçbir uyarı vermez ve `Raporlar` ekranındaki ciro rakamı bu değere dayanır.

**Etkisi:** Güvenlik açığından çok bir iç kontrol boşluğu — sistemdeki tüm kullanıcılar zaten yetkili personel. Ama muhasebe verisinin güvenilirliği doğrudan istemcinin gönderdiğine bağlı ve fiyat değişikliklerinin denetim izi de yok (DEV-30'da belirtildi).

**Nasıl düzeltilmeli:** Sunucu, kalemleri işlerken varyantların kayıtlı fiyatlarını okusun (zaten `varyant_id IN (?)` doğrulaması için okuması gerekiyor — Y-07'deki öneriyle birleşir). Fiyat sapması bir eşiği (ör. %20) aşıyorsa ya reddet ya da `aciklama` alanına "indirimli fiyat" olarak işaretle. En basiti: `birim_fiyat` istemciden hiç alınmasın, sunucu kayıtlı fiyattan hesaplasın, indirim gerekiyorsa ayrı bir `indirim_orani` alanı olsun.

---

#### Y-20 — Toplu uçlarda dizi uzunluğu sınırı yok · **Medium**

**Problem:** F-10'un uygulanmamış üçüncü maddesi, üç uca birden yayılmış durumda.

**Bulunduğu dosya:**
- `sayimController.js:18-20` — `kalemler` dizisi sınırsız
- `satisController.js:139-143` — `tahsisler` dizisi sınırsız
- `satisController.js:58-60`, `satinalmaController.js:60-62` — `kalemler` dizisi sınırsız

`lokasyonController.js:3,245-249` bu dersi almış (`MAKS_BLOK_KAYIT = 5000` + açıklayıcı 400 mesajı) ama disiplin yayılmamış.

**Neden problem:** 200 kB gövde sınırı (`index.js:18`) yaklaşık 3.000-4.000 kalem geçirir. `sayimController` her kalem için 2-4 sorgu çalıştırır (satır 145-208) → tek istekte 12.000 sorguya kadar, hepsi tek transaction içinde, `stok_birimleri` üzerinde geniş kilit tutarak. Bu, kasıtlı bir saldırı gerektirmiyor — hatalı bir istemci döngüsü veya kopyalanmış bir istek yeterli.

**Etkisi:** Uzun süreli transaction → kilit birikimi → diğer tüm stok işlemleri bekler → Y-01'deki deadlock olasılığı artar. Aşırı durumda `queueLimit: 50` dolar ve havuz istek reddetmeye başlar.

**Nasıl düzeltilmeli:** Üç uca da `if (kalemler.length > MAKS_KALEM) return 400` (ör. 500). Tek satır, üç yer. DEV-29'daki `zod` şemasında `.max(500)` olarak da ifade edilebilir.

---

#### Y-21 — `backend/.env.example` frontend değişkeni içeriyor · **Low**

**Problem:** Backend'in örnek env dosyasının sonunda frontend'e ait blok var:
```
# Backend API adresi. Üretimde HTTPS kullanın.
# Bu dosyadaki değerler build sırasında JS bundle'ına gömülür — GİZLİ BİLGİ KOYMAYIN.
VITE_API_URL=http://localhost:3000
```
Aynı blok `frontend/.env.example`'da da var (doğru yerinde).

**Bulunduğu dosya:** `backend/.env.example` (son 3 satır)

**Neden problem:** Kopyala-yapıştır artığı. Backend `VITE_API_URL`'i hiç okumuyor. Kurulum yapan biri bu satırı görüp backend'in bir frontend adresine ihtiyaç duyduğunu sanabilir. Daha sinsi: dosyadaki "değerler bundle'a gömülür — GİZLİ BİLGİ KOYMAYIN" uyarısı backend `.env`'i için **yanlış ve tehlikeli** bir bilgi — backend `.env`'inde `JWT_SECRET` ve `DB_PASSWORD` var ve onlar hiçbir yere gömülmüyor. Yanlış bağlamdaki bir güvenlik uyarısı, doğru uyarıların da ciddiye alınmamasına yol açar.

**Nasıl düzeltilmeli:** Üç satırı sil.

---

#### Y-22 — README yok · **Medium (portfolyo etkisi yüksek)**

**Problem:** Proje kökünde `README.md` yok. `frontend/README.md` Vite'ın **dokunulmamış şablon dosyası** ("This template provides a minimal setup to get React working in Vite with HMR...").

**Bulunduğu dosya:** Kök dizin (`AUDIT.md` ve `backend/`, `frontend/` dışında dosya yok), `frontend/README.md`

**Neden problem:** `AUDIT.md:1026` bunu "yarım saatlik iş, teslimde ilk bakılan yer" diye işaretlemiş, yapılmamış. `backend/db/README.md` iyi yazılmış (kurulum, bootstrap, şema yenileme) ama kimse oraya bakmadan bulamaz.

**Etkisi:** Bu bir portfolyo projesi ise **en yüksek getirili eksik**. Projeyi ilk açan kişi — işe alım yapan bir mühendis dahil — şunları hiçbir yerde bulamıyor: projenin ne yaptığı, ekran görüntüsü, teknoloji yığını, `backend` ve `frontend` için ayrı `npm install` gerektiği, iki `.env` dosyasının oluşturulması gerektiği, veritabanının `backend/db/README.md`'deki adımlarla kurulacağı, ilk kullanıcının nasıl yaratılacağı, hangi portta çalıştığı. Vite şablon README'sinin duruyor olması ayrıca "bitmemiş" izlenimi veriyor.

**Nasıl düzeltilmeli:** Kökte bir `README.md`: bir paragraf tanıtım, 2-3 ekran görüntüsü (`DepoHaritasi` ve `Panel` görsel olarak etkileyici), teknoloji listesi, kurulum adımları (backend + frontend + db), ortam değişkenleri tablosu, mimari şeması, ve `AUDIT.md`/`rapor.md`'ye referans — denetim raporlarının varlığı başlı başına olumlu bir sinyal. `frontend/README.md` silinmeli veya değiştirilmeli.

---

#### Y-23 — Yedekleme kavramı yok · **Medium**

**Problem:** Repoda yedekleme betiği, cron tanımı veya yazılı prosedür yok.

**Bulunduğu dosya:** Yok — `backend/db/` yalnızca `schema.sql` + `README.md` içeriyor.

**Neden problem:** İlk raporun F-21 maddesi "günlük `mysqldump` + binlog ile point-in-time recovery ve **geri yüklemenin test edildiği** yazılı prosedür" öneriyordu; şema dışa aktarımı yapıldı, yedekleme yapılmadı. WMS'te veri kaybı, deponun ne olduğunu bilmemesi demektir — fiziksel mal duruyor ama nerede olduğu bilinmiyor.

**Etkisi:** `schema.sql`'in kendisi bir risk kaynağı: `DROP TABLE IF EXISTS` içeriyor ve `README` doğrudan çalıştırmayı öneriyor. Yanlış veritabanına uygulanırsa veri gider ve **geri dönüş yolu yok**.

**Nasıl düzeltilmeli:** `backend/db/yedekle.sh` (tarih damgalı `mysqldump`, N günlük rotasyon) + `README`'de geri yükleme adımları + `schema.sql` başına uyarı bloğu. Yarım günlük iş, en yüksek getirili sigorta.

---

#### Y-24 — Kullanıcı şifresi sıfırlanamıyor · **Medium**

**Problem:** Şifresini unutan bir kullanıcının hiçbir kurtarma yolu yok.

**Bulunduğu dosya:**
- `frontend/src/pages/Giris.jsx` — "Şifremi unuttum" bağlantısı yok (tüm dosya okundu)
- `backend/routes/passwordRoutes.js` — yalnızca `PATCH /hesap/sifre`, mevcut şifreyi bilmeyi gerektiriyor (`passwordController.js:45-52`)
- `backend/controllers/kullaniciController.js:2` — `ALANLAR = ["rol", "aktif"]`, şifre alanı **yok**

**Neden problem:** Üç yol da kapalı: kullanıcı kendi şifresini sıfırlayamıyor (mevcut şifreyi bilmesi gerekiyor), admin sıfırlayamıyor (`kullaniciController` şifreye dokunmuyor), e-posta ile sıfırlama akışı yok.

**Etkisi:** Şifresini unutan bir depo çalışanı **kalıcı olarak kilitleniyor**. Tek çözüm birinin doğrudan MySQL'e bağlanıp `sifre_hash`'i elle güncellemesi — ki bunun için bcrypt hash'i üretmesi de gerekiyor. Gerçek bir depoda vardiyalı çalışan personelle bu haftalık bir olay olur.

Yanlış çözüm riski de var: admin, kilitlenen kullanıcıyı silemediği için (silme ucu yok) yeni bir hesap açar; eski hesap `aktif=0` bile yapılmadan durur ve `stok_hareketleri` iki farklı kimlik altında birikir.

**Nasıl düzeltilmeli:** En basit ve bu ölçeğe en uygun çözüm: `kullaniciController.guncelle`'ye admin'in geçici şifre atayabildiği bir yol ekle (`PATCH /kullanicilar/:id/sifre-sifirla`, yalnızca admin, yeni şifreyi döner veya alır, `token_surumu`'nu artırır). E-posta altyapısı gerektirmez, 30 satır. `sifre_degistirmeli` bayrağı eklenip ilk girişte değiştirme zorunlu kılınabilir — ama bu ikinci aşama.

---

#### Y-25 — Saat dilimi görüntüleme tarafında çözülmemiş · **Low**

**Problem:** F-19'da not edildi; burada ayrıntısı. `db.js` içinde `timezone` ayarlanmamış ve tarihler istemciye ISO/UTC olarak gidiyor.

**Bulunduğu dosya:** `backend/config/db.js:4-14` (`timezone` yok), `frontend/src/pages/StokHareketleri.jsx:366` (`new Date(h.tarih).toLocaleString("tr-TR")`), `frontend/src/pages/SystemHealth.jsx:77`, `frontend/src/components/Fis.jsx:18`

**Neden problem:** mysql2, `datetime` kolonlarını **Node.js süreç saat dilimine** göre `Date` nesnesine çevirir. `res.json()` bunu ISO 8601 UTC string'ine serileştirir. Tarayıcı `new Date(...)` ile ayrıştırıp yerel saate çevirir. Sunucu ve tarayıcı aynı saat diliminde olduğu sürece sonuç doğru — ki bugün öyle.

Sunucu UTC'ye alınırsa (bulut sağlayıcılarında varsayılan), MySQL'e `NOW()` ile yazılmış Türkiye saatleri UTC olarak yorumlanır ve arayüzde **3 saat ileri** görünür. Rapor tarafı `utils/tarih.js` ile yerel tarihe göre doğru çalıştığı için rapor ile hareket listesi arasında görünür bir tutarsızlık oluşur.

**Etkisi:** Bugün sıfır, deploy günü kafa karıştırıcı. Denetim izinin saatleri yanlış olduğunda "bu işlemi kim ne zaman yaptı" sorusu güvenilirliğini kaybeder.

**Nasıl düzeltilmeli:** `db.js`'e `timezone: "+03:00"` (veya tercihen `"Z"` + tüm uygulamanın UTC'de çalışması, görüntülemenin `Intl` ile yerelleştirilmesi) ekle ve `process.env.TZ`'yi `.env.example`'da belgele. Karar tek yerde verilmeli ve `utils/tarih.js` ile tutarlı olmalı.

---f

#### Y-26 — `/saglik` ucu hız sınırsız · **Low**

**Problem:** `backend/index.js:20-28` — kimlik doğrulaması gerektirmeyen bu uç her çağrıda bir veritabanı sorgusu (`SELECT 1`) tetikliyor ve `express-rate-limit` uygulanmamış.

**Neden problem:** Liveness probe'un kimlik doğrulamasız olması doğru tasarım. Ama havuzdan bağlantı alan, kimliksiz erişilebilen bir uç, düşük maliyetli bir kaynak tüketim yüzeyi.

**Etkisi:** Düşük. `queueLimit: 50` sınırı ve sorgunun ucuzluğu ciddi bir DoS'u zorlaştırıyor.

**Nasıl düzeltilmeli:** Dakikada 60 istek gibi geniş bir limit, veya `SELECT 1` sonucunu birkaç saniye önbelleğe alma. Öncelik düşük.

---

### 3.2 Frontend — Mimari, React pratikleri, performans

#### Y-30 — Lint hiç yeşil olmamış: 48 hata · **Medium**

**Problem:** `package.json:9`'da `"lint": "eslint ."` scripti var, kural seti makul (`js.configs.recommended` + `react-hooks` + `react-refresh`), ama çıktısı yok sayılıyor.

**Ölçüm (`npx eslint .`):** **56 problem — 48 hata, 8 uyarı**, 18 dosyada.

| Kural | Adet | Ne demek |
|---|---|---|
| `no-unused-vars` | 26 | Hepsi `catch (err)` yakalanıp kullanılmayan `err`. Yani 26 yerde hata bilgisi elde edilip **atılıyor**. |
| `react-hooks/set-state-in-effect` | 21 | `useEffect` gövdesinde doğrudan `setState` → basamaklı render |
| `react-hooks/exhaustive-deps` | 8 | Eksik bağımlılık → bayat closure riski |
| `react-refresh/only-export-components` | 1 | `ToastContext.jsx` hem bileşen hem hook export ediyor → HMR bozulur |

**Neden problem:** 26 `no-unused-vars`'ın hepsi aynı desenden geliyor ve bu tesadüf değil — Y-37'deki yutulan hataların istatistiksel izi. `catch (err) { setHata("Veriler yüklenemedi") }` yazıldığında `err` kullanılmıyor, çünkü **gerçek hata mesajı hiçbir zaman kullanıcıya ulaşmıyor**. Lint bu tasarım hatasını 26 kez işaret etmiş, hiçbiri okunmamış.

**Etkisi:** Doğrudan çalışma zamanı hatası değil, ama iki somut sonucu var: (a) gerçek bir `no-unused-vars` hatası (ör. yanlış isimlendirilmiş bir değişken) bu gürültünün içinde görünmez, (b) CI kurulduğunda lint adımı ilk günden kırmızı olur ve devre dışı bırakılma baskısı doğar.

**Nasıl düzeltilmeli:** `catch (err)` bloklarını Y-38'deki hata yönetimi düzeltmesiyle birlikte ele al — `err`'i kullanmaya başladığında 26 hata kendiliğinden kapanır. `set-state-in-effect` için veri çekme mantığı bir custom hook'a (`useVeri`) taşınmalı (Y-33). Ardından lint'i CI'ya bağla ve yeşil tut.

---

#### Y-31 — ErrorBoundary yok: tek hata = beyaz ekran · **High**

**Problem:** Uygulamada hiçbir `ErrorBoundary` veya `componentDidCatch` yok (tüm `frontend/src` tarandı, sıfır eşleşme).

**Bulunduğu dosya:** `frontend/src/App.jsx`, `frontend/src/main.jsx`

**Neden problem:** React 19'da yakalanmayan bir render hatası tüm ağacı unmount eder — kullanıcı **tamamen beyaz bir sayfa** görür, hiçbir mesaj, hiçbir kurtarma yolu yok. Bu teorik bir risk değil; kod tabanında en az üç somut tetikleyici var:

1. **`Sidebar.jsx:107`** — `JSON.parse(localStorage.getItem("kullanici") || "null")`. `localStorage`'daki değer bozulursa (yarım yazma, elle düzenleme, farklı bir uygulamanın aynı origin'de yazması) `JSON.parse` fırlatır. `Sidebar` her korumalı sayfada render edildiği için **tüm uygulama** beyaz ekrana düşer ve kullanıcı çıkış bile yapamaz — çünkü çıkış butonu `Sidebar`'ın içinde. Aynı desen `LokasyonYonetimi.jsx:49` ve `Kullaniciler.jsx:10-12`'de de var.
2. **`axios.js:6`** — `VITE_API_URL` tanımsızsa modül gövdesinde `throw` ediyor. Mesaj açıklayıcı yazılmış ama React ağacının dışında olduğu için kullanıcı yalnızca boş sayfa görür; mesaj sadece konsolda kalır. F-25'in düzeltmesi bu yüzden yarım kalıyor.
3. **Beklenmeyen API şekli** — ör. `Fis.jsx:20-23` `kalemler.reduce(...)` çağırıyor; `kalemler` bir dizi değilse fırlatır.

**Etkisi:** En kötü kullanıcı deneyimi biçimi. Depo çalışanı ne olduğunu anlayamaz, "bozuldu" der ve iş durur. Hata sunucuya da raporlanmadığı için (DEV-30) kimse haberdar olmaz.

**Nasıl düzeltilmeli:**
1. `App.jsx`'i saran bir `ErrorBoundary`: "Bir şeyler ters gitti" + "Sayfayı yenile" butonu + `localStorage.clear()` seçeneği (yukarıdaki 1. senaryodan kurtarır).
2. `KorumaliRota` içinde ikinci bir sınır: bir sayfa çökerse Sidebar ayakta kalsın, kullanıcı başka bir sayfaya geçebilsin.
3. `localStorage` okumalarını `try/catch`'li tek bir yardımcıya al (`kullaniciOku()`), üç yerde tekrarlanan `JSON.parse`'ı ortadan kaldır.

---

#### Y-32 — Kod bölme yok: 788 kB tek chunk · **Medium**

**Problem:** `App.jsx:3-22` 18 sayfayı statik import ediyor; `React.lazy`/`Suspense` kullanılmamış.

**Ölçüm (`npm run build`):**
```
dist/assets/index-*.css   24.54 kB │ gzip:   5.29 kB
dist/assets/index-*.js   788.41 kB │ gzip: 229.70 kB
```
Vite'ın kendi uyarısı: *"Some chunks are larger than 500 kB after minification."*

**Neden problem:** `AUDIT.md`'nin "Doğrulanamayanlar" 11. maddesi ("bundle boyutu ölçülmedi") artık kapandı — maliyet somut. 788 kB'ın büyük kısmı `recharts` (yalnızca `Panel.jsx` kullanıyor) ve `lucide-react`. Yani **giriş sayfasını açan bir kullanıcı, hiç görmeyeceği grafik kütüphanesini indiriyor.**

**Etkisi:** Depo ortamında bu tahmin edilenden önemli: el terminalleri ve tabletler zayıf Wi-Fi'de çalışır. 230 kB gzip, 3G benzeri bir bağlantıda 2-4 saniye ek açılış demek — ve bu her soğuk yüklemede tekrarlanır.

**Nasıl düzeltilmeli:**
1. `React.lazy(() => import("./pages/Panel"))` + `<Suspense fallback={<Spinner/>}>` — 18 sayfa için mekanik değişiklik, mevcut `yukleniyor-kutu` bileşeni fallback olarak hazır.
2. Sadece `Panel`'i lazy yapmak bile `recharts`'ı ana bundle'dan çıkarır — tek satırlık değişiklikle en büyük kazanç.
3. `lucide-react` zaten tree-shakeable (named import kullanılıyor, doğru), ek iş gerekmiyor.

---

#### Y-33 — Sıfır custom hook, sıfır memoization, 500 satırlık sayfalar · **High (mimari)**

**Problem:** Frontend'de hiçbir soyutlama katmanı yok.

**Ölçüm:**
- `frontend/src/hooks/` dizini **yok**
- `useMemo` / `useCallback` / `React.memo` kullanımı: **tüm `.jsx` dosyalarında toplam 1 adet** — `ToastContext.jsx:9`'daki `useCallback`. Sayfalarda ve bileşenlerde sıfır.
- Sayfa boyutları: `LokasyonYonetimi.jsx` 541, `Varyantlar.jsx` 537, `SatisSiparisleri.jsx` 529, `SatinalmaSiparisleri.jsx` 476, `StokHareketleri.jsx` 411, `DepoHaritasi.jsx` 404 satır.

**Neden problem:** Her sayfa aynı beş sorumluluğu tek fonksiyonda taşıyor: veri çekme + yükleme/hata durumu + form durumu + tablo render + modal yönetimi. Bunun somut maliyeti **kod tekrarı olarak ölçülebilir**:

Aynı `veriGetir` deseni **12 sayfada** birebir tekrarlanmış:
```js
const veriGetir = async () => {
  try { const r = await xGetir(); setX(r.data); }
  catch (err) { setHata("X yüklenemedi"); }
  finally { setYukleniyor(false); }
};
useEffect(() => { veriGetir(); }, []);
```
Aynı sayfalama bloğu (Önceki/Sonraki + "Sayfa N / M · Toplam K kayıt") **5 sayfada** kopyalanmış: `Varyantlar.jsx:503-521`, `Urunler.jsx:248-266`, `StokHareketleri.jsx:386-404`, `SatisSiparisleri.jsx:476-494`, `SatinalmaSiparisleri.jsx:435-453` — 19 satırlık blok, 5 kopya, hepsi aynı.

Aynı satır içi düzenleme (inline edit) deseni **5 sayfada**: `Urunler`, `Varyantlar`, `Musteriler`, `Tedarikciler`, `LokasyonYonetimi`. `Musteriler.jsx:153-237` ve `Tedarikciler.jsx:155-235` neredeyse **karakter karakter aynı** — 80 satırlık iki kopya, tek fark alan adları.

Aynı kg↔adet dönüşüm mantığı **3 yerde**: `SatisSiparisleri.jsx:84-105`, `SatinalmaSiparisleri.jsx:85-105`, `StokHareketleri.jsx:109-113`, `Varyantlar.jsx:113-117`. Para ve stok hesabına doğrudan giren mantık, dört kopya, sıfır test (DEV-22).

**Memoization eksikliği:** `SatisSiparisleri.jsx:107-110`'daki `genelToplam`, her render'da tüm kalemler için `kalemHesapla` çalıştırıyor; `kalemHesapla` de her çağrıda `varyantlar.find(...)` yapıyor. Kalem listesi render'ında (satır 254-334) aynı fonksiyon her kalem için bir kez daha çağrılıyor. 5 kalem × ~200 varyant = her tuş vuruşunda 2.000 dizi taraması. Bugün 16 varyantla görünmez, gerçek katalogla hissedilir. `Sidebar.jsx:107,113` da her render'da `JSON.parse` + `menuGruplari()` yeniden çalıştırıyor.

**Etkisi:** Bir hata düzeltmesi 5 yere uygulanmak zorunda (Y-09'daki `tedarikciController` ayrışmasının frontend karşılığı). Yeni bir sayfa eklemek 400 satır kopyalamak demek. Bu, DEV-23'ün (backend servis katmanı) frontend'deki tam karşılığı ve aynı gerekçeyle çözülmeli.

**Nasıl düzeltilmeli — kademeli:**
1. `hooks/useVeri.js` — `{ veri, yukleniyor, hata, yenile }` döndüren jenerik fetch hook'u. 12 sayfadaki tekrarı ve 21 `set-state-in-effect` lint hatasını birlikte kapatır.
2. `hooks/useSayfalama.js` + `components/Sayfalama.jsx` — 5 kopyayı tek bileşene indirir.
3. `utils/birim.js` — `adeteCevir(miktar, birim, ambalajKg)`. Dört kopya tek yere iner ve **test edilebilir hale gelir**; DEV-22'nin 5. senaryosu bunu gerektiriyor.
4. `components/VeriTablosu.jsx` — kolon tanımı + satır içi düzenleme desteğiyle jenerik tablo. `Musteriler`/`Tedarikciler` 250 satırdan ~60 satıra iner.
5. Ardından `useMemo`/`useCallback` — ama **önce yapı, sonra optimizasyon**. Memoization bugünkü veri hacminde ölçülebilir bir kazanç vermez; asıl sorun tekrar.

---

#### Y-34 — Panel, sayaç göstermek için tüm tabloları indiriyor · **High (performans)**

**Problem:** Aynı sayfada aynı iş için iki farklı teknik kullanılmış, biri doğru biri yanlış.

**Bulunduğu dosya:** `frontend/src/pages/Panel.jsx:53-74`
```js
urunleriGetir(),                          // ← parametresiz: TÜM ürünler
varyantlariGetir(),                       // ← parametresiz: TÜM varyantlar
dusukStokGetir(),                         // ← limitsiz uç
tedarikcileriGetir({ limit: 1 }),         // ✅ doğru: 1 kayıt + header
siparisleriGetir({ bekleyen: 1, limit: 1 }), // ✅ doğru
...
urun: urunRes.data.length,                // ← sadece uzunluk için indirildi
varyant: varyantRes.data.length,          // ← sadece uzunluk için indirildi
tedarikci: basliktanSayi(tedarikciRes),   // ✅ X-Toplam-Kayit header'ından
```

**Neden problem:** `basliktanSayi` yardımcısı (satır 35-36) **zaten yazılmış** ve `X-Toplam-Kayit` header'ından sayıyı okuyor. Tedarikçi ve bekleyen sipariş için doğru kullanılmış. Ürün ve varyant için kullanılmamış — oysa `urunController.js:24` ve `varyantController.js:44` aynı header'ı **dönüyor**.

`GET /varyantlar` parametresiz çağrıldığında sayfalama uygulanmıyor (DEV-17: `if (sayfa || limit)`), yani `SELECT v.*` ile **tüm varyantlar tüm kolonlarıyla** iniyor. `GET /urunler` için de aynı, üstelik `GROUP BY` + `LEFT JOIN urun_varyantlari` toplaması ile.

**Etkisi:** Panel, uygulamanın açılış sayfası ve `App.jsx:57`'de `/` yönlendirmesinin hedefi — yani **her oturumun ilk isteği**. 5.000 varyantlı bir katalogda bu, sadece "5000" sayısını yazdırmak için birkaç MB'lık bir JSON indirmek demek. `dusukStokGetir` de limitsiz (`varyantController.js:69-82`) ve tam listesi `dusukListe` olarak tabloya basılıyor (satır 283-294) — kritik stok sayısı yüksekse sayfa kilitlenir.

**Nasıl düzeltilmeli:** İki satır: `urunleriGetir({ limit: 1 })` ve `varyantlariGetir({ limit: 1 })`, ardından `basliktanSayi(...)` kullan. `dusukStokGetir` için uca sayfalama ekle ve panelde ilk 10'u göster + "tümünü gör" bağlantısı. Toplam beş dakikalık değişiklik, en yüksek getirili frontend performans düzeltmesi.

---

#### Y-35 — Açılır listeler sınırsız veri çekiyor · **Medium (performans + UX)**

**Problem:** Varyant ve lokasyon seçicileri her sayfada parametresiz çağrılıyor.

**Bulunduğu dosya:**

| Sayfa | Çağrı | Sonuç |
|---|---|---|
| `SatisSiparisleri.jsx:49-52` | `musterileriGetir()`, `varyantlariGetir()` | 500 müşteri + tüm varyantlar |
| `SatinalmaSiparisleri.jsx:48-52` | `tedarikcileriGetir()`, `varyantlariGetir()`, `lokasyonlariGetir()` | + tüm lokasyonlar |
| `StokHareketleri.jsx:53-56` | `varyantlariGetir()`, `lokasyonlariGetir()` | |
| `Sayim.jsx:28-31` | `lokasyonlariGetir()`, `varyantlariGetir()` | |
| `Varyantlar.jsx:58-61` | `urunleriGetir()`, `kategorileriGetir()` | |

**Neden problem:** İki katmanlı maliyet. (a) Ağ: aynı ağır listeler beş sayfada yeniden indiriliyor, hiçbir önbellek yok — sayfalar arası her geçişte tekrar. (b) DOM: `<select>` içine binlerce `<option>` basılıyor. `SatisSiparisleri.jsx:270-275` her varyant için stok bilgisi de içeren bir etiket üretiyor; 5.000 varyantta bu 5.000 DOM düğümü, üstelik sayfada **iki ayrı select**'te (form + filtre) tekrarlanıyor.

`LokasyonSecici.jsx` bunu bir miktar hafifletmeye çalışmış: kat filtresi + blok bazlı `<optgroup>` (satır 56-93). Doğru yönde bir çaba, ama temel sorunu çözmüyor — 5.000 palet yeri hâlâ tek `<select>` içinde ve **arama yok**.

**Etkisi — UX boyutu daha ağır:** Bir depo çalışanının `L-23-04-K2` lokasyonunu 5.000 seçenekli bir açılır listede bulması pratikte imkânsız. Barkod altyapısı zaten kurulmuş (`GET /stok-birimleri/kod/:kod`, `Pallets.jsx`) ama **operasyonel ekranların hiçbirinde kullanılmıyor** — kullanıcı hâlâ listeden seçiyor. Bu, `AUDIT.md:939`'un tespit ettiği sorunun devamı: barkod okuma yalnızca sorgulama ekranına eklenmiş, iş akışlarına girmemiş.

**Nasıl düzeltilmeli:**
1. Sunucu tarafı arama: `GET /varyantlar?ara=...&limit=20` zaten destekleniyor (`varyantController.js:21-24`). Açılır liste yerine yazdıkça arayan bir combobox.
2. Lokasyon seçicilerine barkod alanı: "rafı okut" → kod ile `GET /lokasyonlar?kod=...`. Mevcut palet sorgulama deseninin aynısı.
3. Sabit veriler (kategoriler, müşteriler, tedarikçiler) için basit bir önbellek — `sessionStorage` veya bir `VeriContext`. Sayfalar arası tekrar indirmeyi bitirir.

---

#### Y-36 — Backend sayfalıyor, frontend sayfalamıyor: sessiz veri kaybı · **High**

**Problem:** F-17 düzeltmesi backend'e sayfalama ekledi, ama dört ekran bunu takip etmedi. Kayıtlar sessizce kesiliyor.

**Bulunduğu dosya:**

| Ekran | Backend limiti | Frontend'de sayfalama |
|---|---|---|
| `Musteriler.jsx:29` | `buildPagination` varsayılanı = **500** | ❌ Yok |
| `Tedarikciler.jsx:29` | 500 | ❌ Yok |
| `Pallets.jsx:22-25` | `LIMIT 500` sabit (`stockUnitController.js:49`) | ❌ Yok |
| `LokasyonYonetimi.jsx:66-67` | Limitsiz ama tümü tek seferde | ❌ Yok |

**Neden problem:** 501. müşteri eklendiğinde `Musteriler` ekranı onu **hiç göstermiyor** ve hiçbir uyarı vermiyor. Kullanıcı listeyi tam sanıyor. `X-Toplam-Kayit` header'ı doğru toplamı dönüyor ama bu ekranlar onu okumuyor bile.

`Pallets.jsx` özellikle kritik: bu ekranın **tek işi** depodaki paletleri listelemek. 500 palet, orta ölçekli bir depoda birkaç aylık iş. 501. paletten sonra ekran sessizce eksik veri gösteriyor ve kullanıcı "palet kayıp" sanıp sayım başlatıyor.

**Etkisi:** Sessiz veri kaybı, kullanıcının fark edemeyeceği türden. Yanlış zihinsel model → yanlış operasyonel karar. Bu, "backend düzeltildi ama frontend takip etmedi" sınıfının en somut örneği ve tek bir yerde değil dört yerde.

**Nasıl düzeltilmeli:** Sayfalama bloğu projede zaten beş yerde çalışıyor (Y-33'te listelendi) — kopyalanacak, ya da Y-33'ün 2. maddesindeki `Sayfalama` bileşeni yazılıp altı yerde birden kullanılacak. Ayrıca `stockUnitController.list`'e `offset` eklenmeli (DEV-17). Geçici asgari önlem: `toplam > gosterilen` ise "İlk 500 kayıt gösteriliyor" uyarısı — beş dakikalık iş, sessiz kaybı en azından görünür kılar.

---

#### Y-37 — Yutulan hatalar: ağ arızası "veri yok" olarak gösteriliyor · **Medium**

**Problem:** F-31'in ilk maddesi kapanmamış, yer değiştirmiş.

**Bulunduğu dosya:**
```js
// StokHareketleri.jsx:96-98
getStockUnits({ varyant_id: form.varyant_id })
  .then((res) => setBirimler(res.data.filter((b) => Number(b.miktar) > 0)))
  .catch(() => setBirimler([]));            // ← hata yutuldu
```
Sonuç: `StokHareketleri.jsx:197` açılır listede **"Bu varyantın stoğu yok"** yazıyor.

```js
// DepoHaritasi.jsx:63-67
try { const response = await lokasyonStok(lokasyonId); setSeciliStok(response.data); }
catch (err) { setSeciliStok([]); }          // ← hata yutuldu
```
Sonuç: `DepoHaritasi.jsx:286` **"Bu lokasyonda stok yok"** yazıyor.

**Neden problem:** Ağ hatası ile boş sonuç ayırt edilmiyor ve kullanıcıya **olumlu bir yanlış bilgi** veriliyor. "Bu lokasyonda stok yok" cümlesi kesin bir iddiadır; kullanıcı buna güvenerek raftan mal çıkarmayabilir, sayım başlatabilir veya siparişi reddedebilir. "Yüklenemedi" demek ile "yok" demek arasındaki fark, depo operasyonunda karar farkıdır.

`DepoHaritasi.jsx`'te durum daha kötü: token süresi dolmuşsa `axios.js:24-31` zaten `/giris`'e yönlendiriyor, ama 500 veya ağ kopması durumunda kullanıcı sessizce yanlış bilgi görüyor.

**Etkisi:** Yanlış operasyonel karar. Ayrıca teşhis edilemez: hata hiçbir yere loglanmıyor, kullanıcı "stok görünmüyor" diye şikâyet ettiğinde nedeni bulmanın yolu yok.

**Nasıl düzeltilmeli:** Üç durumu ayır — `yukleniyor` / `hata` / `bos`. `catch` içinde `setBirimHatasi(true)` ve arayüzde "Stok bilgisi alınamadı · Tekrar dene" göster. Y-38 ile birlikte tek bir desende çözülmeli.

---

#### Y-38 — Hata durumu terminal: sayfa kurtarılamıyor · **High (UX)**

**Problem:** Neredeyse tüm sayfalarda `hata` state'i sayfanın **tamamını** değiştiriyor ve hiçbir zaman temizlenmiyor.

**Bulunduğu dosya — desen 12 sayfada aynı:**
```js
if (hata) return <p className="hata-metni">{hata}</p>;
```
`Varyantlar.jsx:187`, `Urunler.jsx:110`, `Musteriler.jsx:99`, `Tedarikciler.jsx:99`, `Kategoriler.jsx:64`, `StokHareketleri.jsx:152`, `SatisSiparisleri.jsx:231`, `SatinalmaSiparisleri.jsx:204`, `Sayim.jsx:144`, `LokasyonYonetimi.jsx:160`, `DepoHaritasi.jsx:138`, `Raporlar.jsx:42`, `SystemHealth.jsx:40`, `Pallets.jsx:67`

**Neden problem:** Tek bir isteğin başarısızlığı, sayfadaki **her şeyi** siliyor — form, filtreler, tablo, hatta yeniden deneme yolu. En keskin iki örnek:

1. **`Raporlar.jsx:42`** — `if (hata) return <p>...</p>` satırı, tarih seçicilerinin **öncesinde**. Geçersiz bir tarih aralığı girildiğinde (backend `raporController.js:12-14` 400 dönüyor) sayfa tek bir hata satırına indirgeniyor ve **tarihi düzeltecek input'lar da kayboluyor**. Kullanıcının tek çıkışı sayfayı yenilemek. Üstelik backend'in gönderdiği anlamlı mesaj ("Başlangıç tarihi bitiş tarihinden sonra olamaz") `catch (err) { setHata("Rapor yüklenemedi") }` ile **atılıyor** (satır 25-27) — kullanıcı neyi yanlış yaptığını öğrenemiyor.

2. **`SystemHealth.jsx:40`** — `if (error) return` satırı, "Yeniden Çalıştır" butonunun (satır 58) öncesinde. Kontroller bir kez başarısız olursa yeniden çalıştırma butonu ekrandan siliniyor.

3. **`LokasyonYonetimi.jsx:66-73`** — `Promise.all([lokasyonlariGetir(), tutarlilikKontrol()])` tek `catch` paylaşıyor. Yalnızca tutarlılık ucu başarısız olsa bile (ki admin olmayan bir kullanıcı için 403 döner) tüm lokasyon yönetimi ekranı kayboluyor.

**Etkisi:** Geçici bir ağ kesintisi kalıcı bir arıza gibi görünüyor. Kullanıcı yenilemeyi bilmiyorsa iş duruyor. Bu, `bos-durum`, `spinner`, `OnayModal` gibi diğer durumların özenle tasarlandığı bir arayüzde en zayıf halka.

**Nasıl düzeltilmeli:**
1. Hatayı sayfanın **üstünde bir banner** olarak göster, içeriği koruyarak. `hata-kutusu` sınıfı `Giris.jsx:72`'de zaten bu iş için var.
2. Banner'a "Tekrar dene" butonu koy.
3. Başarılı her istekten sonra `setHata("")` — `Raporlar.jsx:24` ve `SystemHealth.jsx:28` bunu doğru yapıyor, diğerleri yapmıyor.
4. `err.response?.data?.hata` mesajını kullan — backend anlamlı mesajlar üretiyor, atmayın. Bu aynı zamanda Y-30'daki 26 `no-unused-vars` hatasını kapatır.
5. Bağımsız istekleri ayrı `catch`'lere böl (`LokasyonYonetimi`).

---

#### Y-39 — Sipariş oluşturmada çift gönderim koruması yok · **High**

**Problem:** DEV-15'te tabloyla listelendi; burada en kritik iki örnek.

**Bulunduğu dosya:** `SatisSiparisleri.jsx:168-194`, `SatinalmaSiparisleri.jsx:157-183`
```js
const handleSubmit = async (e) => {
  e.preventDefault();
  try { await satisOlustur({...}); ... }     // ← `gonderiliyor` state'i yok
```
Submit butonu (`SatisSiparisleri.jsx:340`) `disabled` almıyor.

**Neden problem:** Yavaş bir bağlantıda kullanıcı butona ikinci kez basar → **iki ayrı sipariş** oluşur. Backend'de bunu engelleyecek hiçbir mekanizma yok (DEV-15: idempotanlık anahtarı yok) ve iki sipariş de tamamen meşru görünür.

Aynı projede `PickingModal.jsx:14,201` ve `TransferModal.jsx:19,118` bu korumayı doğru uygulamış — yani desen biliniyor, en riskli iki formda atlanmış.

**Etkisi:** Çift sipariş, çift stok rezervasyonu (rezervasyon eklendiğinde), müşteriye çift sevkiyat riski, muhasebede çift kayıt. Fark edilmesi zor çünkü iki sipariş de listede normal görünüyor ve iptal edilmezse sonsuza kadar kalıyor — satınalma tarafında iptal ucu bile yok (Y-13).

**Nasıl düzeltilmeli:** `const [gonderiliyor, setGonderiliyor] = useState(false)` + `try/finally` + `disabled={gonderiliyor}`. Yedi formda, mevcut iki örnekten kopyalanarak, bir saatlik iş. Kalıcı çözüm DEV-15'in idempotanlık anahtarı.

---

#### Y-40 — Modallar unmount olmuyor: bayat form durumu · **Medium**

**Problem:** Modal bileşenleri `if (!acik) return null` kontrolünü **hook'lardan sonra** yapıyor, yani hiç unmount olmuyor ve state'leri kalıcı.

**Bulunduğu dosya:**
```js
// TransferModal.jsx:16-21
const [hedefId, setHedefId] = useState("");
const [miktar, setMiktar] = useState("");
const [aciklama, setAciklama] = useState("");
const [gonderiliyor, setGonderiliyor] = useState(false);
if (!acik || !stokSatiri) return null;      // ← hook'lardan SONRA
```
`kapat` (satır 115) yalnızca `acik`'ı `false` yapıyor; state'leri sıfırlamıyor. Sıfırlama yalnızca **başarılı kaydetmede** yapılıyor (satır 39-41).

**Neden problem — somut senaryo:** Kullanıcı A paletinden 50 adet taşımak için modalı açar, miktar alanına `50` yazar, "Vazgeç" der. B paletine tıklayıp "Taşı" der → **miktar alanında hâlâ `50` yazıyor** ve hedef lokasyon da önceki seçim. B paletinde 20 adet varsa kullanıcı 50 girmiş görünür; fark etmezse sunucu reddeder (iyi), fark etmez ve miktar uygunsa **yanlış miktarda transfer yapar**.

`TeslimAlModal.jsx:6-9` aynı sorunu taşıyor: `lokasyonId` önceki siparişten kalıyor. Kullanıcı A siparişini X rafına almayı seçip vazgeçerse, B siparişinde X rafı önceden seçili gelir ve dikkatsizce onaylanabilir.

**İkinci kusur — `TeslimAlModal.jsx:11-17`:**
```js
const kaydet = async (e) => {
  setGonderiliyor(true);
  await onayla(lokasyonId);      // ← bu fonksiyon modalı hemen kapatıyor
  setGonderiliyor(false);
  setLokasyonId("");
};
```
`onayla` = `SatinalmaSiparisleri.teslimAlOnayla` (satır 185-195) ve ilk işi `setTeslimAlinacak(null)` — yani modal **istek başlamadan** kapanıyor. Sonuç: `gonderiliyor` state'i ve "İşleniyor..." metni **hiçbir zaman görünmüyor**; kullanıcı butona basıyor, modal kayboluyor ve saniyelerce hiçbir geri bildirim almadan bekliyor. Ölü kod + eksik geri bildirim.

**Nasıl düzeltilmeli:**
1. Modalları çağıran tarafta koşullu render et: `{teslimAlinacak && <TeslimAlModal .../>}`. Bileşen gerçekten unmount olur, state kendiliğinden sıfırlanır ve `if (!acik) return null` kontrolüne gerek kalmaz. En temiz çözüm.
2. `TeslimAlModal` için: `onayla`'yı `await` edip **sonra** kapat, veya kapatma sorumluluğunu modal'a ver.

---

#### Y-41 — Modallarda klavye ve odak yönetimi yok · **Medium (erişilebilirlik)**

**Problem:** Dört modal bileşeninin hiçbirinde temel modal davranışı yok.

**Bulunduğu dosya:** `OnayModal.jsx`, `TransferModal.jsx`, `TeslimAlModal.jsx`, `PickingModal.jsx`, `Fis.jsx`

| Beklenen davranış | Durum |
|---|---|
| `Escape` ile kapanma | ❌ Yok |
| Odak tuzağı (focus trap) | ❌ Yok — Tab, modalın arkasındaki forma kaçıyor |
| Açılışta odaklanma | ❌ Yok (yalnızca `DepoHaritasi.jsx:313`'te satır içi `autoFocus` var) |
| Kapanışta odağın geri dönmesi | ❌ Yok |
| `role="dialog"` / `aria-modal="true"` | ❌ Yok |
| `aria-labelledby` başlığa bağlı | ❌ Yok |
| Arka plan kaydırma kilidi | ❌ Yok |
| Perdeye tıklayınca veri kaybı uyarısı | ❌ Yok |

**Neden problem:** Son madde en pratik olanı: `PickingModal.jsx:108` — `<div className="modal-perde" onClick={kapat}>`. Kullanıcı 12 palet için tek tek miktar girdikten sonra yanlışlıkla modalın dışına tıklarsa **tüm giriş kaybolur**, uyarı yok, geri alma yok. Aynı risk `TransferModal` ve `TeslimAlModal`'da da var.

Klavye tarafı: modal açıkken Tab tuşu arkadaki forma geçiyor — ekran okuyucu kullanıcısı modalın varlığını hiç fark etmiyor, çünkü `aria-modal` yok ve odak taşınmıyor.

**Etkisi:** Veri kaybı (en somut), erişilebilirlik ihlali (WCAG 2.1.2 "No Keyboard Trap" ve 4.1.2 "Name, Role, Value"), klavye ağırlıklı çalışan depo personeli için verimsizlik.

**Nasıl düzeltilmeli:** Tek bir `Modal` kabuk bileşeni yaz: `role="dialog" aria-modal="true" aria-labelledby`, `Escape` dinleyicisi, odak tuzağı, `document.body.style.overflow` kilidi, ve **form içeriği doluysa perdeye tıklamada onay iste**. Dört modal bu kabuğun içine alınır. Modern tarayıcılarda `<dialog>` elementi bunların çoğunu yerleşik sağlıyor ve mevcut CSS'e uyarlanabilir.

---

#### Y-42 — Erişilebilirlik: sıfır ARIA, sıfır label bağlantısı, buton odak stili yok · **Medium**

**Problem:** Ölçüldü — `frontend/src` altındaki tüm `.jsx` dosyalarında:
- `aria-*` veya `role=` kullanımı: **0** (yalnızca `assets/*.svg` içinde, kod değil)
- `htmlFor`: **0**
- `id` ile ilişkilendirilmiş `<label>`: **0**

**Bulunduğu dosya:** Tüm formlar. Tipik desen (`Varyantlar.jsx:194-201`):
```jsx
<div className="form-alan">
  <label>Ürün</label>                    {/* ← htmlFor yok, input'u sarmıyor */}
  <select name="urun_id" ...>            {/* ← id yok */}
```

**Ayrıca `index.css`:**
```css
input:focus, select:focus { outline: none; border-color: ...; box-shadow: ...; }
```
Input ve select için `outline` kaldırılmış ama **görsel bir alternatif konmuş** — bu doğru yapılmış. Ancak `button` için hiçbir `:focus` veya `:focus-visible` kuralı **yok** (satır 437-451 arası `button` bloğu tarandı). Tarayıcı varsayılan odak halkası da `outline: none` global bir kural olmadığı için korunuyor olabilir — ancak `button` üzerinde `border: none` tanımlı ve özel bir odak stili verilmediği için odak göstergesi tema ile tutarsız ve düşük kontrastlı kalıyor.

**Neden problem:**
1. **Label bağlantısı yok:** Ekran okuyucu `<select>`'e geldiğinde "Ürün" demiyor, sadece "combo box" diyor. Ayrıca label'a tıklamak input'u odaklamıyor — dokunmatik cihazlarda küçük radyo/checkbox hedefleri için hissedilir bir kayıp (`LokasyonYonetimi.jsx:426-443`'teki iki checkbox tam bu durumda).
2. **Toast'lar duyurulmuyor:** `ToastContext.jsx:20-31` — `aria-live` yok. İşlem sonucu ("Sipariş oluşturuldu", "Silinemedi") ekran okuyucuya hiç iletilmiyor. Bu, uygulamanın **tüm geri bildirim mekanizması** olduğu için ciddi.
3. **İkon butonlar:** `Sidebar.jsx:173-193`, `SatisSiparisleri.jsx:371-381` — sadece ikon içeren butonlar `title` ile etiketlenmiş. `title` bir yedek, `aria-label` değil; ekran okuyucu desteği tutarsız.
4. **Renk tek başına anlam taşıyor:** `DepoHaritasi.jsx:9-25` doluluk durumunu yalnızca renkle gösteriyor (`dolu`/`bos`/`asim`/`orta`/`az`). Lejant var (satır 182-195) ve bu iyi — ama hücrelerin kendisinde metin yok, renk körü bir kullanıcı doluluk okuyamıyor.

**Etkisi:** Klavye ve ekran okuyucu kullanıcıları için uygulama pratikte kullanılamaz. Kurumsal bir alıcı için erişilebilirlik giderek bir satın alma kriteri; portfolyo açısından ise ARIA bilgisi kıdem göstergesi olarak okunuyor.

**Nasıl düzeltilmeli — hepsi ucuz:**
1. `<label htmlFor="x">` + `<input id="x">`. En hızlısı: `<label>` etiketini input'u **saracak** şekilde değiştirmek — `id` gerektirmez, mevcut CSS `.form-alan label` seçicisiyle uyumlu kalır.
2. `ToastContext.jsx:20`'deki kapsayıcıya `role="status" aria-live="polite"` (hata toast'ları için `aria-live="assertive"`). İki attribute, en yüksek getirili düzeltme.
3. İkon butonlara `aria-label` ekle (`title` kalabilir).
4. `button:focus-visible { outline: 2px solid var(--renk-birincil); outline-offset: 2px; }`.
5. Palet hücrelerine doluluk metnini ekle veya `aria-label`'a taşı.

---

#### Y-43 — Grafikler açık temada bozuk · **Medium (UI)**

**Problem:** `Panel.jsx`'teki üç Recharts grafiğinin renkleri koyu tema için sabit kodlanmış.

**Bulunduğu dosya:** `frontend/src/pages/Panel.jsx:26, 161, 167-172`
```js
const EKSEN = { fill: "#94a3b8", fontSize: 12 };
<CartesianGrid stroke="#3f3f46" />
<Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", color: "#e4e4e7" }} />
```

**Neden problem:** Uygulamanın çalışan bir açık/koyu tema sistemi var — `index.css:1-36` CSS değişkenleriyle iki tema tanımlıyor, `Sidebar.jsx:122-127` ve `Giris.jsx:25-30` geçişi sağlıyor, tercih `localStorage`'da saklanıyor. Grafikler bu sistemin **tamamen dışında**.

Açık temada (`--renk-yuzey: #ffffff`) sonuç: beyaz zemin üzerinde `#3f3f46` koyu gri ızgara çizgileri (fazla baskın), `#94a3b8` açık gri eksen yazıları (düşük kontrast), ve tooltip **siyah kutu** olarak beliriyor. Panel, uygulamanın açılış sayfası olduğu için açık temayı seçen kullanıcı ilk gördüğü ekranda bu tutarsızlıkla karşılaşıyor.

**Etkisi:** Görsel tutarsızlık ve okunabilirlik kaybı. Portfolyo bağlamında özellikle göze batıyor: tema sistemi kurulmuş ama en görsel ekranda uygulanmamış.

**Nasıl düzeltilmeli:** Renkleri CSS değişkenlerinden oku. Recharts JS değeri beklediği için `getComputedStyle(document.documentElement).getPropertyValue('--renk-metin-soluk')` ile okunup bir `useState`'e alınmalı ve tema değişiminde güncellenmeli — bir `useTema()` hook'u bunu hem `Sidebar` hem `Panel` için tek yerde çözer (tema state'i şu an `Sidebar.jsx:109` ve `Giris.jsx:14`'te iki kez ayrı ayrı yönetiliyor, bu da ayrıca bir tekrar).

---

#### Y-44 — `sort()` karşılaştırıcısız: 10. kattan sonra sıra bozuluyor · **Low**

**Problem:** Sayısal diziler varsayılan (sözlüksel) sıralama ile sıralanıyor.

**Bulunduğu dosya:**
```js
// DepoHaritasi.jsx:143
const katlar = [...new Set(tumPaletler.map((l) => l.kat))].sort();
// LokasyonSecici.jsx:16
const katlar = [...new Set(paletler.map((l) => l.kat))].sort();
```

**Neden problem:** `[1, 2, 10].sort()` → `[1, 10, 2]`. `lokasyonlar.kat` bir `int` (`schema.sql:53`). 10 veya daha fazla katlı bir raf sisteminde kat seçici butonları (`DepoHaritasi.jsx:164-175`) ve açılır liste (`LokasyonSecici.jsx:59-63`) yanlış sırada görünür.

**Etkisi:** Bugün sıfır (mevcut veri tek haneli katlar). Yüksek raflı bir depoda (12-15 kat yaygındır) kafa karıştırıcı. `blokOlustur` kat sayısına üst sınır koymuyor, yani veri bunu üretebilir.

**Nasıl düzeltilmeli:** `.sort((a, b) => a - b)`. İki dosya, iki karakter grubu. Projede aynı işlem başka yerlerde **doğru** yapılmış (`satisController.js:168`, `sayimController.js:104`) — backend'de bilinen kural frontend'de uygulanmamış.

---

#### Y-45 — Tema `useEffect`'te uygulanıyor: açılışta yanıp sönme · **Low**

**Problem:** Kayıtlı tema, React mount olduktan sonra uygulanıyor.

**Bulunduğu dosya:** `frontend/src/App.jsx:25-28`
```js
useEffect(() => {
  const kayitliTema = localStorage.getItem("tema") || "dark";
  document.documentElement.setAttribute("data-tema", kayitliTema);
}, []);
```

**Neden problem:** `index.css:1-17` `:root` varsayılanını **koyu** tema olarak tanımlıyor. Açık temayı seçmiş bir kullanıcı sayfayı yenilediğinde: HTML yüklenir → koyu tema boyanır → JS bundle (788 kB, Y-32) indirilip çalışır → `useEffect` çalışır → açık temaya geçer. Yavaş bağlantıda bu **birkaç saniye süren koyu bir yanıp sönme** (FOUC).

**Etkisi:** Kozmetik ama ilk izlenimi doğrudan etkiliyor ve Y-32 ile birleşince (büyük bundle = geç çalışan JS) belirginleşiyor.

**Nasıl düzeltilmeli:** `index.html`'in `<head>`'ine 3 satırlık senkron bir inline script:
```html
<script>document.documentElement.setAttribute('data-tema', localStorage.getItem('tema') || 'dark')</script>
```
CSS'ten önce çalışır, yanıp sönme tamamen ortadan kalkar. Standart çözüm.

---

#### Y-46 — 404 rotası yok, `/` yönlendirmesi `replace` kullanmıyor · **Low**

**Problem:** `frontend/src/App.jsx:33-58` — hiçbir `path="*"` rotası yok.

**Neden problem:** Tanımsız bir URL (`/urunlerr`, eski bir yer imi, yanlış yazılmış bir adres) hiçbir rotayla eşleşmiyor → `<Routes>` hiçbir şey render etmiyor → kullanıcı **tamamen boş bir sayfa** görüyor. Menü bile yok, çünkü `Sidebar` `KorumaliRota` içinde.

İkincisi: `App.jsx:57` — `<Route path="/" element={<Navigate to="/panel" />} />`, `replace` prop'u yok. Kullanıcı `/`'a girip `/panel`'e yönlendirildikten sonra geri tuşuna bastığında `/`'a döner, oradan tekrar `/panel`'e yönlendirilir — **geri tuşu çalışmıyor gibi görünür**.

**Etkisi:** Boş sayfa, Y-31'deki beyaz ekranla aynı kullanıcı algısını yaratıyor: "bozuldu".

**Nasıl düzeltilmeli:** `<Route path="*" element={<Navigate to="/panel" replace />} />` veya daha iyisi bir `BulunamadiSayfasi` bileşeni ("Sayfa bulunamadı · Panele dön"). `Navigate`'lere `replace` ekle. Beş dakikalık iş.

---

#### Y-47 — Rol kontrolü rota katmanında değil, sayfaların içinde · **Medium**

**Problem:** `KorumaliRota` yalnızca token varlığına bakıyor; rol kontrolü iki sayfada ayrı ayrı, kopyalanarak yapılmış.

**Bulunduğu dosya:**
```js
// KorumaliRota.jsx:5-9 — sadece token
const token = localStorage.getItem("token");
if (!token) return <Navigate to="/giris" />;
```
```js
// LokasyonYonetimi.jsx:83-85 ve Kullaniciler.jsx:38-40 — sayfa içinde, kopyala-yapıştır
if (kullanici?.rol !== "admin") return <Navigate to="/panel" />;
```
`SystemHealth.jsx` — **bu kontrolü hiç yapmıyor**, oysa `healthRoutes.js:7` `izinVer("admin")` istiyor.

**Neden problem:**
1. `SystemHealth` sayfasına admin olmayan bir kullanıcı doğrudan URL ile girerse (`/sistem-sagligi`) sayfa açılıyor, `getSystemChecks()` çağrılıyor, 403 dönüyor ve kullanıcı **"Bu işlem için yetkiniz yok"** hata metnini boş bir sayfada görüyor. Menüde link yok (`Sidebar.jsx:83-89`) ama URL çalışıyor.
2. `LokasyonYonetimi.jsx:79-85` — `useEffect` hook'u koşullu return'dan **önce** kayıtlı olduğu için, admin olmayan bir kullanıcı sayfaya girdiğinde `veriGetir()` yine de çalışıyor ve `/lokasyonlar/tutarlilik` çağrısı 403 alıyor. Yönlendirme gerçekleşiyor ama gereksiz iki istek atılıyor.
3. Kontrol `localStorage`'daki role dayanıyor — kullanıcı elle değiştirip admin sayfalarını **görebilir**. Backend `izinVer` uyguladığı için **güvenlik açığı değil**, ama kullanıcı boş sayfalar ve 403'lerle karşılaşır.

**Etkisi:** Tutarsız ve kırılgan. Yeni bir admin sayfası eklendiğinde kontrolü eklemeyi hatırlamak gerekiyor — `SystemHealth`'te zaten unutulmuş, yani mekanizma çalışmıyor.

**Nasıl düzeltilmeli:** Rol kontrolünü rota katmanına taşı:
```jsx
<Route element={<KorumaliRota rol="admin" />}>
  <Route path="/kullanicilar" element={<Kullanicilar />} />
  ...
```
Tek yerde tanımlanır, unutulamaz, sayfalar iş mantığına odaklanır. `Sidebar`'daki menü filtresi de aynı rol tanımından beslenebilir — böylece menü ve rota **tek kaynaktan** senkron kalır.

---

#### Y-48 — Riskli işlemlerde onay yok, risksizlerde var · **Medium (UX)**

**Problem:** Onay modalı dağılımı riskle ters orantılı.

| İşlem | Geri alınabilir mi | Onay |
|---|---|---|
| Kategori silme | Evet (yeniden eklenir) | ✅ `OnayModal` |
| Müşteri silme | Kısmen | ✅ `OnayModal` |
| **Kullanıcıyı yönetici yapma** | Evet ama yetki yükseltmesi | ❌ **Yok** — `Kullanicilar.jsx:157-164` |
| **Kullanıcıyı pasife alma** | Evet | ❌ Yok — `Kullanicilar.jsx:170-177` |
| **5.000 lokasyon üretme** | **Hayır** (toplu silme yok) | ❌ Yok — `LokasyonYonetimi.jsx:342` |
| **Sipariş teslim etme** (stok düşer) | **Hayır** | ❌ Yok — `PickingModal` doğrudan gönderiyor |
| Sipariş iptali | Hayır | ✅ `OnayModal` |

**Neden problem — üç somut örnek:**

1. **`Kullanicilar.jsx:157-164`** — rol değişimi bir `<select onChange>`'e bağlı. Yanlışlıkla bir tuşa basmak veya listede kayarken tekerlek çevirmek **bir kullanıcıyı anında yönetici yapıyor**. Toast "Rol güncellendi" diyor ve iş bitiyor. Oysa aynı ekranda çok daha az riskli işlemler onay istiyor.

2. **`LokasyonYonetimi.jsx:342-447`** — "Blok Üret" formu tek tıkla 5.000'e kadar lokasyon yaratabiliyor (`MAKS_BLOK_KAYIT`). Önizleme yok, kaç kayıt oluşacağı **gönderilmeden önce gösterilmiyor** (`sira × derinlik × kat` çarpımı kullanıcı tarafından hesaplanmalı), onay yok. Yanlış girilen bir "kat: 50" değeri 5.000 lokasyon üretir ve **bunları silmenin toplu bir yolu yok** — tek tek, her biri için onay modalıyla silinmesi gerekir. Geri alınamaz bir işlem, onaysız.

3. **`PickingModal.jsx:80-105`** — "Teslim Et" fiziksel stok düşürüyor ve `stok_hareketleri`'ne kalıcı kayıt yazıyor. Geri alma yolu yok. Onay yok. Buna karşılık aynı siparişin **iptali** onay istiyor (`SatisSiparisleri.jsx:509-516`) — oysa iptal hiçbir stoğa dokunmuyor.

**Etkisi:** Kullanıcı, onay modallarının "önemli işlemlerde çıktığını" öğreniyor; çıkmadığında işlemin önemsiz olduğunu varsayıyor. Bu, yanlış bir güvenlik hissi yaratıyor ve en pahalı hataları en korumasız yerde bırakıyor.

**Nasıl düzeltilmeli:** Onay kriterini yeniden tanımla: **geri alınamayan veya yetki değiştiren** her işlem onay ister. `OnayModal` bileşeni zaten var ve kullanımı üç satır.
- Rol değişimine onay: "X kullanıcısı **Yönetici** yapılacak. Yönetici tüm kullanıcıları, lokasyonları ve sistem ayarlarını yönetebilir."
- Blok üretimine önizleme + onay: "**480 palet yeri** oluşturulacak (12 sıra × 4 derinlik × 10 kat). Bu işlem toplu olarak geri alınamaz."
- Teslim etmeye özet onay: "3 üründe toplam 240 adet, 5 birimden düşülecek."

---

#### Y-49 — `urunApi.dusukStokGetir` var olmayan bir uca gidiyor · **Low**

**Problem:** `frontend/src/api/urunApi.js:7`
```js
export const dusukStokGetir = () => api.get("/urunler/dusuk-stok");
```
Backend'de böyle bir uç **yok**. `urunRoutes.js` yalnızca `/`, `/:id`, `POST /`, `PUT /:id`, `DELETE /:id` tanımlıyor.

**Neden problem:** Çağrılırsa `GET /urunler/dusuk-stok` isteği `router.get("/:id", urunController.getirTek)` ile eşleşir; `id = "dusuk-stok"` olarak `WHERE u.id = 'dusuk-stok'` sorgusu çalışır (MySQL bunu `0`'a çevirir), sonuç boş döner ve **404 "Ürün bulunamadı"** alınır. Yani sessiz ve yanıltıcı bir başarısızlık.

Şu an çağrılmıyor — `Panel.jsx:17` doğru olanı (`varyantApi`'dekini) import ediyor. Yani ölü kod, ama iki dosyada **aynı isimde iki farklı fonksiyon** olması bir gün yanlış import'a yol açacak bir tuzak.

**Nasıl düzeltilmeli:** Satırı sil. Aynı taramada `transferApi.transferleriGetir` de hiç kullanılmıyor (Y-50).

---

#### Y-50 — Transfer geçmişi ekranı yok · **Medium**

**Problem:** `GET /transferler` ucu tam olarak yazılmış — sayfalamalı, `X-Toplam-Kayit` header'lı, ürün/lokasyon/kullanıcı JOIN'li (`transferController.js:3-36`). Frontend'de `transferleriGetir` fonksiyonu da yazılmış (`transferApi.js:3`). **Hiçbir sayfa çağırmıyor.**

**Neden problem:** Kullanıcı stok taşıyabiliyor (`TransferModal`) ama yaptığı transferleri **hiçbir yerde göremiyor**. `StokHareketleri` ekranı transferleri göstermiyor çünkü transferler `stok_hareketleri`'ne yazılmıyor (Y-05). Yani transfer, kullanıcı açısından iz bırakmayan bir işlem.

**Etkisi:** "Bu palet neden A rafından B rafına geçmiş, kim taşımış?" sorusunun arayüzden cevabı yok. Depo operasyonunda bu, sorumluluk takibinin kopması demek. Ayrıca yazılmış bir backend özelliği (sayfalama dahil) boşa gidiyor.

**Nasıl düzeltilmeli:** İki seçenek. (a) Y-05'i çöz (transferleri `stok_hareketleri`'ne yaz) — o zaman mevcut `StokHareketleri` ekranı transferleri otomatik gösterir ve ayrı bir ekran gerekmez. **Tercih edilen.** (b) `Transferler.jsx` sayfası ekle — mevcut liste desenini kopyalayarak yarım günlük iş, ama iki ayrı geçmiş ekranı kullanıcıyı böler.

---

#### Y-51 — Sayımda birim değiştirmek girilen değerleri sessizce yeniden yorumluyor · **Medium**

**Problem:** `Sayim.jsx:164-170` — "Sayım birimi" (adet/kg) seçicisi **tüm satırlar için global** ve değiştiğinde önceden girilmiş değerlerin anlamı değişiyor.

**Bulunduğu dosya:** `Sayim.jsx:97-103`
```js
return birim === "kg" ? sayi / (Number(satir.ambalaj_kg) || 1) : sayi;
```

**Neden problem — somut senaryo:** Kullanıcı 10 satır için adet cinsinden sayım girer (ör. her birine `100`). Sonra 11. satırı kg olarak girmek ister ve seçiciyi "kg" yapar. O anda **önceki 10 satırın hepsi** yeniden yorumlanır: `100 adet` iken `100 kg ÷ 10 kg ambalaj = 10 adet` olur. Fark sütunu (satır 272-285) anında `-90` göstermeye başlar. Hiçbir uyarı yok.

Kullanıcı bunu fark etmezse — ki fark sütunu zaten kırmızı sayılarla doluyken fark etmesi zor — sayımı kaydeder ve **stok 10 kat düşer**. Sayım, stok doğruluğunun son savunma hattı olduğu için bu, en tehlikeli konumda duran bir UX hatası.

**Etkisi:** Doğrudan ve büyük ölçekli stok bozulması. Y-11'deki (sayım kaydı yok) eksiklikle birleşince, olayın sonradan tespit edilip geri alınması da imkânsız.

**Nasıl düzeltilmeli:** Üç seçenek, artan kalitede:
1. Birim değiştiğinde girilmiş değerler varsa onay iste: "Girilen 10 değer kg olarak yeniden hesaplanacak."
2. Birimi satır bazında yap — her satırın kendi adet/kg seçicisi olsun (mevcut `miktar-girisi` bileşeni bunu zaten destekliyor, `StokHareketleri.jsx:234-247`'de kullanılıyor).
3. Birim değiştiğinde girilen değerleri **koru ve dönüştür** (100 adet → 1000 kg yazsın), böylece anlam sabit kalır. En doğrusu bu.

---

#### Y-52 — Bayat stok verisi ve bloklamayan uyarılar · **Medium**

**Problem:** Sipariş formundaki stok bilgisi mount anında bir kez çekiliyor ve bir daha yenilenmiyor.

**Bulunduğu dosya:** `SatisSiparisleri.jsx:76-78` (`tanimlariYukle` yalnızca `[]` bağımlılığıyla), `SatisSiparisleri.jsx:272-273` (açılır listede `stok: {Number(v.miktar).toFixed(0)}`), `SatisSiparisleri.jsx:255-257` (yetersiz stok uyarısı)

**Neden problem:** İki ayrı sorun bir arada.
1. **Veri bayat:** Sekme saatlerce açık kalabilir. Gösterilen "stok: 240" saatler önceki değer. Sipariş oluşturulduktan sonra da liste yenilenmiyor (`handleSubmit` yalnızca `siparisleriYukle()` çağırıyor, `tanimlariYukle()` çağırmıyor — satır 186-190). `StokHareketleri.jsx:139` bunu doğru yapıyor (`tanimlariYukle()` çağırıyor), `SatisSiparisleri` yapmıyor. Tutarsız.
2. **Uyarı bloklamıyor:** `yetersiz` hesaplanıp kırmızı metin gösteriliyor (satır 328-329) ama form **yine de gönderilebiliyor**. Backend de engellemiyor, çünkü rezervasyon yok (DEV-13) — sipariş oluşturmada stok hiç kontrol edilmiyor.

**Etkisi:** Kullanıcı kırmızı uyarıyı görüp yine de devam edebiliyor, ya da hiç görmüyor çünkü veri bayat. Sorun teslim anında ortaya çıkıyor — DEV-13'te anlatılan "en pahalı hata anı".

**Nasıl düzeltilmeli:** Kısa vadede: sipariş oluşturulduktan sonra `tanimlariYukle()` çağır; uyarı varken submit'i `disabled` yap veya ek onay iste ("Stok yetersiz görünüyor, yine de sipariş oluşturulsun mu?"). Kalıcı çözüm DEV-13 (rezervasyon) — o zaman sunucu sipariş anında reddeder ve arayüzdeki tahmin gereksizleşir.

---

#### Y-53 — `index.html` varsayılan şablon değerlerinde kalmış · **Low**

**Problem:** `frontend/index.html`
```html
<html lang="en">                    <!-- ← uygulama tamamen Türkçe -->
<title>frontend</title>             <!-- ← Vite şablon değeri -->
```
`<meta name="description">` yok, `<meta name="theme-color">` yok.

**Neden problem:**
- `lang="en"` — ekran okuyucular Türkçe metni **İngilizce telaffuz kurallarıyla** okur. Erişilebilirlik açısından somut bir hata (WCAG 3.1.1 "Language of Page").
- `<title>frontend</title>` — tarayıcı sekmesinde, yer imlerinde ve tarayıcı geçmişinde "frontend" yazıyor. Birden fazla sekmeyle çalışan bir kullanıcı hangisinin WMS olduğunu ayırt edemiyor. Ayrıca sayfa başına dinamik başlık yok — her sayfada aynı.

**Etkisi:** Küçük ama portfolyo bağlamında orantısız görünür: `favicon.svg` özel olarak hazırlanmış (`public/favicon.svg` mevcut), yani görsel kimliğe emek verilmiş ama başlık atlanmış.

**Nasıl düzeltilmeli:** `lang="tr"`, `<title>WMS · Depo Yönetim Sistemi</title>`, bir `description` ve `theme-color`. Rota bazlı başlık için küçük bir `useBaslik(baslik)` hook'u — beş satır. SEO burada anlamsız (kimlik doğrulamalı iç uygulama), ama `lang` ve `title` erişilebilirlik ve kullanılabilirlik meselesi.

---

#### Y-54 — İstek iptali yok: yarış koşulları · **Medium**

**Problem:** Hiçbir yerde `AbortController` veya iptal mekanizması kullanılmıyor (tüm `frontend/src` tarandı).

**Bulunduğu dosya — üç somut yarış:**

1. **`SatisSiparisleri.jsx:112-128` (`detayAc`)** — kullanıcı 5 numaralı siparişin detayını açar, yanıt gelmeden 8 numaralıya tıklar. `acikDetay = 8` olur ama 5'in yanıtı sonra gelirse `setDetayKalemler(5'in kalemleri)` çalışır → **8 numaralı siparişin altında 5 numaralının kalemleri görünür**. Kullanıcı yanlış siparişe bakarak karar verir. Aynı desen `SatinalmaSiparisleri.jsx:112-128`'de de var.

2. **`Varyantlar.jsx:98-100`** — arama debounce'lu (400 ms, satır 90-96, doğru yapılmış) ama istekler iptal edilmiyor. Yavaş bağlantıda "kova" araması "kov" aramasından **önce** dönerse tablo "kov" sonuçlarını gösterir ve arama kutusunda "kova" yazar. Aynı desen `Urunler.jsx:51-53` ve `Pallets.jsx:40-42`'de.

3. **`DepoHaritasi.jsx:60-70` (`stokGetir`)** — hızlıca iki farklı lokasyona tıklandığında ilkinin yanıtı ikincinin üzerine yazabilir → **yanlış lokasyonun stoğu** gösterilir. Bu ekranda özellikle riskli: kullanıcı gördüğü stoğa göre "Taşı" veya "Paletle" işlemi başlatıyor ve `TransferModal`'a `secili` (doğru lokasyon) ile `stokSatiri` (yanlış lokasyondan gelen satır) birlikte geçiyor.

**Etkisi:** Düşük frekanslı ama yüksek etkili — kullanıcı yanlış veriye bakarak fiziksel bir işlem yapıyor. 3. senaryoda yanlış paletin taşınmasına yol açabilir.

**Nasıl düzeltilmeli:** İki yaklaşım:
- **Basit:** Bir `istekId` sayacı; yanıt geldiğinde `if (istekId !== guncelId) return`. Beş satır, tüm senaryoları çözer.
- **Doğrusu:** `useEffect` içinde `AbortController` + cleanup'ta `abort()`. Y-33'teki `useVeri` hook'una yerleştirilirse **tüm sayfalarda tek seferde** çözülür.

---

#### Y-55 — Frontend bağımlılıklarında 4 açık (2'si yeni) · **Low**

**Ölçüm (`npm audit`, 4 Ağustos):**
```
react-router      7.12.0 - 8.2.0   high      (AUDIT.md'de kabul edilen risk)
react-router-dom  >=7.12.0-pre.0   high      (yukarıdakinin taşıyıcısı)
brace-expansion   4.0.0 - 5.0.8    high      YENİ
postcss           <=8.5.22         moderate  YENİ
backend: 0 açık
```

**Değerlendirme:** `brace-expansion` ve `postcss` ikisi de Vite zincirinden gelen **geliştirme bağımlılıkları**; production runtime'a (`dist/` çıktısı) dahil değiller. Etki düşük. `react-router` kararı `AUDIT.md:820-851`'de gerekçelendirilmiş durumda ve gerekçe hâlâ geçerli (proje RSC kullanmıyor — `App.jsx` `BrowserRouter` ile saf istemci SPA, doğrulandı).

**Not:** Bu denetimde internet erişimi olmadığı için advisory sayfaları **yeniden okunamadı**. Yukarıdaki tablo yerel `npm audit` çıktısıdır; `brace-expansion` ve `postcss` için yamalı sürümlerin çıkmış olup olmadığı doğrulanamadı.

**Neden yine de bir bulgu:** İki yeni açık 3 Ağustos'tan bu yana eklenmiş ve **hiçbiri fark edilmemiş**. `AUDIT.md`'nin `react-router` kararı iyi yazılmış ama bir kereye mahsus; süregelen bir süreç kurulmamış. Raporun kendi önerisi ("CI'ya `npm audit --audit-level=high` adımı ekle") uygulanmamış ve zaten CI yok.

**Nasıl düzeltilmeli:** `npm audit fix` (dev bağımlılıkları için kırıcı değişiklik olmadan çözülmesi muhtemel), ardından bir CI adımı. Kabul edilen riskler için `.npmauditignore` benzeri bir dosya veya `package.json`'da bir not — böylece "bilinen ve kabul edilmiş" ile "yeni ve incelenmemiş" ayırt edilebilir.

---

#### Y-56 — Sayı ve para biçimlendirmesi tutarsız · **Low**

**Problem:** Aynı tür veri farklı ekranlarda farklı biçimlerde gösteriliyor.

**Bulunduğu dosya:**
```js
// Fis.jsx:3-8 — DOĞRU: sabit 2 basamak
Number(sayi).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// SatisSiparisleri.jsx:388 — basamak belirtilmemiş → "1.234,5" veya "1.234"
{Number(s.toplam_tutar).toLocaleString("tr-TR")} ₺

// Panel.jsx:289-290 — ham string: DECIMAL kolonu "100.00" olarak basılıyor
<td>{v.miktar}</td>
<td>{v.kritik_seviye}</td>

// Raporlar.jsx:49 — ham string
alt: `${ozetBul("giris").toplam_miktar} adet`

// Varyantlar.jsx:480 — Number + toFixed(0)
{Number(v.miktar).toFixed(0)}
```

**Neden problem:** `decimalNumbers` ayarlanmadığı için (F-19 kalanı) MySQL `DECIMAL` kolonları **string** olarak geliyor. Bazı yerlerde `Number()` ile dönüştürülüyor, bazı yerlerde ham basılıyor. Sonuç: `Panel`'in kritik stok tablosunda "100.00" yazarken `Varyantlar` ekranında aynı değer "100" yazıyor. Para tarafında `Fis` "1.234,50 ₺" derken sipariş tablosu "1.234,5 ₺" diyor.

**Etkisi:** Kozmetik ama fiyat gösteriminde güven kırıcı — 2 haneli olmayan bir tutar "eksik yazılmış" izlenimi verir.

**Nasıl düzeltilmeli:** `utils/bicim.js` — `para(deger)`, `adet(deger)`, `kg(deger)`. `Fis.jsx:3-8`'deki `paraFormat` zaten doğru yazılmış, oraya taşınıp her yerde kullanılmalı. Kök çözüm: `db.js`'e `decimalNumbers: true` (Y-25 ile birlikte).

---

#### Y-57 — Toast sistemi eksik · **Low**

**Problem:** `frontend/src/context/ToastContext.jsx` (38 satır) minimal.

**Eksikler:**
- `aria-live` yok (Y-42'de anlatıldı) — ekran okuyucu hiçbir geri bildirim almıyor
- Kapatma butonu yok — kullanıcı 3 saniye beklemek zorunda
- Süre sabit 3 sn — uzun hata mesajları okunamıyor. Örneğin `satisController.js:257`'nin ürettiği mesaj ("Kırma (201/230) için seçilen miktar siparişle uyuşmuyor — sipariş 240, seçilen 180") 3 saniyede okunamaz.
- `setTimeout` unmount'ta temizlenmiyor (satır 12-14)
- Aynı mesaj tekrar tetiklenirse yığılıyor, gruplanmıyor
- Provider değeri `bildir` fonksiyonunun kendisi — `useCallback` ile sarılmış (doğru), ama ileride `kapat` gibi ikinci bir fonksiyon eklendiğinde nesne dönmek gerekecek ve o zaman `useMemo` şart olacak

**Neden problem:** Toast, uygulamanın **tek geri bildirim mekanizması**. Hata mesajları buradan geçiyor ve `err.response?.data?.hata` ile backend'in özenle yazdığı açıklayıcı mesajlar burada gösteriliyor — 3 saniyede kaybolarak.

**Nasıl düzeltilmeli:** `role="status"` + `aria-live="polite"` (hatalar için `assertive`), kapatma butonu, hata toast'ları için daha uzun süre (6-8 sn) veya elle kapatma zorunluluğu, `useEffect` cleanup ile timer temizliği.

---

#### Y-58 — Fiş: WhatsApp numarayı kullanmıyor, yazdırma tek bileşene bağlı · **Low**

**Problem:** `frontend/src/components/Fis.jsx:42-45`
```js
window.open(`https://wa.me/?text=${metin}`, "_blank");
```
Alıcı numarası yok — oysa `telefon` değişkeni satır 17'de zaten mevcut (`siparis.musteri_telefon` / `tedarikci_telefon`) ve satır 69-74'te ekranda gösteriliyor.

**Neden problem:** Kullanıcı WhatsApp'ta alıcıyı elle seçmek zorunda. `wa.me/905xxxxxxxxx?text=...` biçimi doğrudan sohbeti açardı. Numara biçiminin normalize edilmesi gerekir (`5xx xxx xx xx` → `905xxxxxxxxx`) çünkü `Musteriler.jsx:122` placeholder'ı boşluklu biçim öneriyor ve `telefon` `varchar(20)` olarak serbest metin.

**İkinci nokta — yazdırma:** `index.css:1215-1242` `@media print` bloğu doğru yazılmış (`body * { visibility: hidden }` + `.fis, .fis * { visibility: visible }`), `Fis` bileşeni temiz basılıyor. İyi bir detay. Ancak bu kural **yalnızca `.fis` sınıfına** bağlı — kullanıcı bir stok listesini veya sayım sonucunu yazdırmak isterse (depoda çok yaygın bir ihtiyaç) sayfa boş çıkar. Yazdırılabilir toplama listesi (`AUDIT.md:1059`) ve sayım formu eksikliği bu noktada birleşiyor.

**Nasıl düzeltilmeli:** Telefon normalizasyonu için küçük bir `utils/telefon.js`. Yazdırma için `.yazdirilabilir` gibi genel bir sınıf ve tablo ekranlarında bir "Yazdır" butonu.

---

#### Y-59 — Toplama ekranı manuel ve rehbersiz · **Medium (UX)**

**Problem:** `PickingModal` doğru çalışıyor ama kullanıcıyı yalnız bırakıyor.

**Bulunduğu dosya:** `frontend/src/components/PickingModal.jsx`

**Dört eksik:**

1. **Otomatik doldurma yok.** 240 adetlik bir kalem 12 palete dağılmışsa kullanıcı 12 ayrı input'a elle miktar yazıp toplamın tam 240 olmasını sağlamak zorunda (satır 72-74: `hepsiTamam` tam eşitlik istiyor). Sunucu tarafında tahsis planı hesaplanacak bilgi zaten var. Bir "Otomatik doldur" butonu (FIFO, en eski palet önce, veya en az palet bozacak şekilde) bu ekranı dakikalardan saniyelere indirir. `AUDIT.md:1074` otomatik tahsisi "bilinçli olarak yapılmadı" diye işaretlemiş — ama karar "sistem karar vermesin" idi, "kullanıcıya öneri sunulmasın" değil. Öneri + düzenleme imkânı ikisini birleştirirdi.

2. **Varyant başına ayrı istek.** `PickingModal.jsx:24-27`:
```js
const sonuclar = await Promise.all(varyantIdleri.map((vid) => getStockUnits({ varyant_id: vid })));
```
5 kalemlik bir siparişte 5 ayrı HTTP isteği. Backend `varyant_id` filtresini tekil alıyor (`stockUnitController.js:10-13`); `varyant_id IN (?)` desteği eklenip tek istek yapılabilirdi. Klasik N+1, ağ katmanında.

3. **Pasif lokasyonlar filtrelenmiyor.** `stockUnitController.list` `l.aktif` filtresi uygulamıyor. Kullanıcıya kullanımdan kaldırılmış bir rafta duran stok toplama seçeneği olarak sunuluyor. `healthController.js:32-41` bu durumu "Pasif Lokasyonda Stok · uyarı" olarak raporluyor — yani bilinen bir durum, ama toplama ekranına yansıtılmamış.

4. **Sıralama rastgele.** `stockUnitController.js:48` — `ORDER BY sb.tip, sb.kod, l.kod`. Yani paletler koda göre alfabetik. Ne FIFO (en eski önce), ne FEFO, ne de lokasyon yakınlığı. Depo personeli listeye bakıp hangisinden alacağına kendi karar veriyor ve bu karar her seferinde farklı olabiliyor.

**Etkisi:** Toplama, depodaki en sık tekrarlanan işlem. Buradaki her fazla saniye günde yüzlerce kez çarpılıyor. Ayrıca 4. madde stok rotasyonunu tesadüfe bırakıyor — gıda ürününde (proje zeytin işliyor, `ambalaj_tipi: kova/teneke`, `boy` kalibre) bu doğrudan fire demek.

**Nasıl düzeltilmeli:** (1) "Otomatik doldur" butonu — mevcut `secimDegistir` mantığıyla dolduran, kullanıcının düzenleyebildiği bir öneri. (2) `varyant_id IN (?)` desteği. (3) `list`'e `l.aktif = TRUE` filtresi (veya `sadece_aktif=1` parametresi). (4) `ORDER BY sb.olusturulma_tarihi` (FIFO) — parti/SKT eklendiğinde FEFO'ya evrilir.

---

#### Y-60 — Tablo animasyonları her veri yenilemesinde tekrarlanıyor · **Low (UX)**

**Problem:** `index.css:520-528` ve `551-582`
```css
table { animation: belir 0.5s ease-out 0.1s backwards; }
tbody tr { animation: belir 0.35s ease-out backwards; }
tbody tr:nth-child(1) { animation-delay: 0.03s; }   /* 8 satır için kademeli gecikme */
tbody tr:hover { transform: translateX(4px); }
```

**Neden problem:** Her veri yenilemesinde (ve bu proje her işlemden sonra listeyi yeniliyor — `veriGetir()` çağrıları) **tüm tablo yeniden beliriyor** ve ilk 8 satır kademeli olarak kayarak giriyor. İlk görüşte hoş; günde 200 stok hareketi giren bir depo çalışanı için her kayıttan sonra tekrarlanan yarım saniyelik animasyon yorucu ve işi yavaşlatıyor.

`tbody tr:hover { transform: translateX(4px) }` — fare tabloda gezinirken satırlar sağa kayıyor. Veri tablosunda kolon hizası bozuluyor ve okuma zorlaşıyor. Mobilde devre dışı bırakılmış (`index.css:1040-1042`) — yani sorun fark edilmiş ama masaüstünde bırakılmış.

`input:focus { transform: scale(1.02) }` (satır 434) — tablo içi düzenleme modunda input'a odaklanınca hücre büyüyor ve satır düzeni oynuyor.

**Olumlu not:** `@media (prefers-reduced-motion: reduce)` bloğu var (`index.css:1055`) ve animasyonları kapatıyor. Bu doğru ve çoğu projede atlanan bir detay — ancak varsayılan davranışın kendisi veri yoğun bir uygulama için fazla hareketli.

**Nasıl düzeltilmeli:** Giriş animasyonlarını yalnızca ilk mount'ta çalıştır (bir `animasyonlu` sınıfını koşullu ekleyerek) veya tamamen kaldır. `tr:hover` için `transform` yerine yalnızca `background-color` kullan (zaten var — `tbody tr:hover td`). `input:focus`'tan `scale`'i çıkar; `box-shadow` odak göstergesi olarak zaten yeterli.

---

#### Y-61 — Kritik bilgi 11px yazıyla gösteriliyor · **Low (UI)**

**Problem:** `index.css` — `.kucuk-not { font-size: 11px; color: var(--renk-metin-soluk); }`

**Neden problem:** Bu sınıf yalnızca ikincil bilgi için değil, **operasyonel olarak kritik** bilgiler için de kullanılıyor:
- `SatisSiparisleri.jsx:323-330` — miktar dönüşümü ve "yetersiz stok (mevcut 180 adet)" uyarısı
- `PickingModal.jsx:138-145` — "Gereken 240 · Seçilen 180 · 60 adet eksik"
- `Sayim.jsx:293-296` — "12 birim sayıldı · 3 birimde fark var"
- `LokasyonYonetimi.jsx:502-507` — konum koordinatları

11px, soluk renkte (`#94a3b8` koyu temada, `#64748b` açık temada), depo ortamında (eldivenli el, uzaktan bakış, kötü aydınlatma, yaşça büyük personel) okunması zor. Kontrast oranları WCAG AA'yı geçiyor (koyu temada ~7.4:1, açık temada ~4.8:1) — yani sorun kontrast değil, **boyut**.

**Nasıl düzeltilmeli:** `.kucuk-not` 12-13px'e çıkarılmalı. Daha iyisi: uyarı niteliğindeki metinler için ayrı bir sınıf (`.uyari-not`) — 14px, normal kontrast, belki bir ikon. `hata-metni` sınıfı zaten `yetersiz` durumunda kullanılıyor (`SatisSiparisleri.jsx:323`) ama o da `.kucuk-not` ile aynı boyut ailesinde.

---

#### Y-62 — Depo haritası ölçeklenmiyor · **Medium (performans)**

**Problem:** `DepoHaritasi.jsx:200-251` — tüm lokasyonlar tek bir CSS grid içine, her biri bir `<button>` olarak basılıyor.

**Bulunduğu dosya:** `DepoHaritasi.jsx:145-153`
```js
const maxSatir = Math.max(1, ...tumGorunur.map((l) => l.satir + (l.satir_span || 1) - 1));
const maxKolon = Math.max(1, ...tumGorunur.map((l) => l.kolon + (l.kolon_span || 1) - 1));
```

**Üç sorun:**
1. **Sanallaştırma yok.** `blokOlustur` 5.000 lokasyon üretebiliyor. Kat filtresi bir miktar azaltıyor (satır 141) ama tek katta binlerce palet yeri olabilir → binlerce DOM düğümü, her biri iki `<span>` içeren bir buton. İlk render saniyeler sürer ve kaydırma takılır.
2. **`Math.max` spread'i.** `Math.max(1, ...dizi)` — dizi çok büyükse (~100.000+) yığın taşması riski. 5.000'de sorun değil ama desen kırılgan; `reduce` ile yazılmalı.
3. **Grid boyutu veriye bağlı ve sınırsız.** Yanlışlıkla `satir: 9999` girilen tek bir lokasyon (`lokasyonController.ekle` üst sınır koymuyor — yalnızca `>= 1` kontrolü var, satır 54-63) grid'i 9.999 satıra çıkarır. `grid-template-rows: repeat(9999, minmax(34px, auto))` tarayıcıyı kilitler.

**Etkisi:** Depo haritası projenin görsel olarak en etkileyici ekranı ve demo'da ilk gösterilecek yer. Gerçek ölçekte açılmaması, hem operasyonel hem portfolyo açısından maliyetli.

**Nasıl düzeltilmeli:** (1) Kat filtresini zorunlu yap (şu an varsayılan `kat=1`, ama tek katta da çok olabilir) + blok filtresi ekle — `LokasyonYonetimi` bunu zaten yapıyor (satır 451-481), harita yapmıyor. (2) Görünür alan sanallaştırması veya SVG'ye geçiş (binlerce `<rect>` binlerce `<button>`'dan çok daha ucuz ve zoom/pan doğal gelir). (3) `lokasyonController.ekle`/`guncelle`'ye `satir`/`kolon` üst sınırı (ör. 500).

---

#### Y-63 — Raporlama modülü zayıf ve dışa aktarma yok · **Medium (özellik)**

**Problem:** `Raporlar.jsx` (194 satır) yalnızca bir rapor sunuyor: tarih aralığındaki stok hareketi özeti.

**Mevcut:** giriş/çıkış/düzeltme sayıları, çalışan bazlı işlem dağılımı, en çok hareket gören 10 kalem, satınalma sipariş tutarı.

**Eksik olanlar — bir WMS'te standart:**
- **Stok değerleme raporu** — elde bulunan stoğun parasal değeri. `urun_varyantlari.birim_fiyat` ve `stok_birimleri.miktar` mevcut, sorgu tek satır. Muhasebenin ay sonunda ilk isteyeceği rapor.
- **Satış raporu** — `satis_siparisleri` üzerinden ciro, müşteri bazlı dağılım. `Raporlar` yalnızca **satınalma** tutarını gösteriyor (`raporController.js:69-74`), satış tarafı hiç yok. Asimetrik ve muhtemelen gözden kaçmış.
- **Stok yaşlandırma** — hangi mal ne kadar süredir depoda. `stok_birimleri.olusturulma_tarihi` var, sorgu basit. Gıda ürününde kritik.
- **Sayım doğruluk raporu** — Y-11'deki `sayimlar` tablosu olmadan üretilemiyor.
- **Excel/CSV dışa aktarma** — hiçbir ekranda yok. `AUDIT.md:1061` bunu "muhasebeye veri aktarımı için pratikte en çok istenen şey" diye işaretlemiş.

**Ayrıca `Raporlar.jsx:32-34`:**
```js
useEffect(() => { veriGetir(); }, [baslangic, bitis]);
```
Debounce yok. `<input type="date">` kullanıcı yıl alanını yazarken ara değerler üretir (`0002-01-01`, `0020-01-01` ...) ve her biri bir istek tetikler. Backend `gecerliGunMu` ile biçimi doğruluyor ama bu değerler biçimsel olarak geçerli — yani dört anlamsız sorgu çalışıyor.

**Etkisi:** "Raporlar" menüsü var ama içeriği tek bir operasyonel özet. Bir yöneticinin sistemden bekleyeceği finansal ve envanter raporları yok. Excel çıktısı olmadığı için veriler sistemden dışarı çıkarılamıyor — kullanıcı ekrandan elle kopyalıyor.

**Nasıl düzeltilmeli:** Öncelik sırasıyla: (1) CSV dışa aktarma — istemci tarafında mevcut tablo verisinden üretilebilir, yarım günlük iş, en yüksek getiri. (2) Stok değerleme raporu — tek sorgu. (3) Satış raporunu satınalmanın yanına ekle (simetri). (4) Tarih inputlarına debounce.

---

#### Y-64 — 1850 satırlık tek CSS dosyası · **Low**

**Problem:** `frontend/src/index.css` = 1850 satır, tüm uygulamanın stilleri.

**Neden problem:** Hangi kuralın hangi bileşene ait olduğu belirsiz. Bir bileşen silindiğinde stilleri kalıyor (ölü CSS). Sınıf adları global — `.kart`, `.modal`, `.etiket` gibi genel adlar çakışmaya açık.

**Olumlu not:** Dosyanın **içeriği** kalitesi yüksek — CSS değişkenleriyle iki tema, `@media (max-width: 900px)` ve `768px` breakpoint'leri, `prefers-reduced-motion` desteği, `@media print` kuralları, mobilde tablo yatay kaydırma (`table { display: block; overflow-x: auto }`). Bunlar çoğu junior projede bulunmayan detaylar. Sorun organizasyon, kalite değil.

**Bir gerçek kusur:** Tablo yatay kaydırma yalnızca `max-width: 768px` altında etkin. `StokHareketleri` tablosu 9 kolonlu; 768-1100px arası genişlikte (tablet yatay, küçük dizüstü) tablo taşıyor ve **sayfanın kendisi** yatay kaydırılıyor — sidebar dahil her şey kayıyor. Kaydırma kuralı breakpoint'ten bağımsız olmalı: tablolar her zaman kendi `overflow-x: auto` kapsayıcısında olmalı.

**Nasıl düzeltilmeli:** CSS Modules (`Panel.module.css`) veya en azından dosya bölme (`base.css`, `bilesenler.css`, `sayfalar.css`) + `@import`. Vite ikisini de destekliyor. Tablo kaydırma kuralını breakpoint dışına taşı.

---

#### Y-65 — Frontend'de sıfır test · **High**

**Problem:** DEV-22 backend testlerini kapsıyor; frontend'de de hiç test yok, test scripti bile yok (`package.json:5-10`: `dev`, `build`, `lint`, `preview`).

**Neden problem:** Test edilmesi gereken saf mantık mevcut ve izole edilebilir durumda:
- kg ↔ adet dönüşümü (dört kopya — Y-33)
- `PickingModal.jsx:44-74` — kalem gruplama ve `hepsiTamam` toplam eşleştirmesi
- `Sayim.jsx:97-111` — sayılan/fark hesabı ve birim dönüşümü (Y-51'deki hatanın tam olarak burada olması tesadüf değil)
- `DepoHaritasi.jsx:9-25` — `dolulukSinifi` eşik mantığı
- `Etiket.jsx` — durum eşleme

Bunların hepsi saf fonksiyon haline getirilebilir ve `vitest` ile bağımlılıksız test edilebilir. Vite zaten kurulu, `vitest` doğal eşi.

**Etkisi:** Para ve stok hesabına giren mantık doğrulanmıyor. Y-51'deki birim dönüşüm hatası, bu mantık test edilseydi yazılırken yakalanırdı.

**Nasıl düzeltilmeli:** `vitest` + hesaplama mantığını `utils/`'e çıkar (Y-33'ün 3. maddesi) + o fonksiyonlar için birim testler. React Testing Library ile bileşen testleri ikinci aşama; önce saf mantık, çünkü getirisi en yüksek ve maliyeti en düşük olan orada.

---

### Bölüm 3 Özeti — Yeni bulgular

| ID | Başlık | Kategori | Öncelik |
|---|---|---|---|
| Y-01 | Tablolar arası kilit sırası tutarsız → deadlock | Eşzamanlılık | **Critical** |
| Y-02 | `varyantController.ekle` hayali stok üretiyor | Veri bütünlüğü | **Critical** |
| Y-11 | Sayım oturumu/kilidi/geçmişi yok | İş mantığı | **High** |
| Y-13 | Satınalma iptali ve kısmi teslim yok | İş mantığı | **High** |
| Y-31 | ErrorBoundary yok → beyaz ekran | Error handling | **High** |
| Y-33 | Sıfır hook/memo, 500 satırlık sayfalar, ağır tekrar | Mimari | **High** |
| Y-34 | Panel tüm tabloları indiriyor | Performans | **High** |
| Y-36 | Backend sayfalıyor, frontend sayfalamıyor | Edge case | **High** |
| Y-38 | Hata durumu terminal, kurtarılamıyor | UX | **High** |
| Y-39 | Sipariş formlarında çift gönderim | Edge case | **High** |
| Y-65 | Frontend'de sıfır test | Test | **High** |
| Y-03 | Negatif stok koruması ve CHECK kısıtı eksik | Veri bütünlüğü | Medium |
| Y-04 | Transfer transaction dışında okuyor | Eşzamanlılık | Medium |
| Y-05 | Transferler hareket defterine yazılmıyor | Denetlenebilirlik | Medium |
| Y-07 | `guncelle` fonksiyonları doğrulamasız | Error handling | Medium |
| Y-08 | `varyantController.sil` eksik FK kontrolü | Error handling | Medium |
| Y-09 | `tedarikciController` geride kalmış | Kod kalitesi | Medium |
| Y-15 | `kapasite` anlamı çelişkili | Mimari | Medium |
| Y-16 | Lokasyon `aktif` sıfırlanıyor, pasife alma yok | Edge case | Medium |
| Y-17 | `dogrula` iki kez çalışıyor | Performans | Medium |
| Y-18 | Eksik indeksler | Performans | Medium |
| Y-19 | Fiyat sunucuda doğrulanmıyor | Güvenlik | Medium |
| Y-20 | Toplu uçlarda dizi sınırı yok | Güvenlik | Medium |
| Y-22 | README yok | Dokümantasyon | Medium |
| Y-23 | Yedekleme yok | Operasyon | Medium |
| Y-24 | Şifre sıfırlanamıyor | İş mantığı | Medium |
| Y-30 | 48 lint hatası | Kod kalitesi | Medium |
| Y-32 | Kod bölme yok, 788 kB | Performans | Medium |
| Y-35 | Açılır listeler sınırsız | Performans/UX | Medium |
| Y-37 | Yutulan hatalar | Error handling | Medium |
| Y-40 | Modallarda bayat state | State yönetimi | Medium |
| Y-41 | Modal klavye/odak yönetimi | Accessibility | Medium |
| Y-42 | Sıfır ARIA, label bağlantısı yok | Accessibility | Medium |
| Y-43 | Grafikler açık temada bozuk | UI | Medium |
| Y-47 | Rol kontrolü rota katmanında değil | Mimari | Medium |
| Y-48 | Onay dağılımı riskle ters orantılı | UX | Medium |
| Y-50 | Transfer geçmişi ekranı yok | Özellik | Medium |
| Y-51 | Sayımda birim değişimi değerleri bozuyor | Edge case | Medium |
| Y-52 | Bayat stok verisi, bloklamayan uyarı | UX | Medium |
| Y-54 | İstek iptali yok, yarış koşulları | Async | Medium |
| Y-59 | Toplama ekranı manuel ve rehbersiz | UX | Medium |
| Y-62 | Depo haritası ölçeklenmiyor | Performans | Medium |
| Y-63 | Raporlama zayıf, dışa aktarma yok | Özellik | Medium |
| Y-06 | Paletleme hareket defterine yazılmıyor | Denetlenebilirlik | Low |
| Y-10 | `kategoriController` `ER_DUP_ENTRY` yakalamıyor | Error handling | Low |
| Y-12 | `hazirlaniyor` ölü kod | Kod kalitesi | Low |
| Y-14 | Sayfalama üç yerde farklı | Kod tekrarı | Low |
| Y-21 | `backend/.env.example` kirli | Kod kalitesi | Low |
| Y-25 | Saat dilimi görüntülemede çözülmemiş | Edge case | Low |
| Y-26 | `/saglik` hız sınırsız | Güvenlik | Low |
| Y-44 | `sort()` karşılaştırıcısız | Edge case | Low |
| Y-45 | Tema `useEffect`'te → FOUC | UI | Low |
| Y-46 | 404 rotası yok | Navigation | Low |
| Y-49 | Ölü API fonksiyonu | Kod kalitesi | Low |
| Y-53 | `index.html` şablon değerlerinde | SEO/a11y | Low |
| Y-55 | 2 yeni bağımlılık açığı | Bağımlılık | Low |
| Y-56 | Sayı/para biçimlendirme tutarsız | UI | Low |
| Y-57 | Toast sistemi eksik | UX/a11y | Low |
| Y-58 | WhatsApp numarayı kullanmıyor | UX | Low |
| Y-60 | Tablo animasyonları tekrarlanıyor | UX | Low |
| Y-61 | Kritik bilgi 11px | UI | Low |
| Y-64 | 1850 satır tek CSS | Dosya organizasyonu | Low |

**Toplam yeni bulgu: 62** (2 Critical, 9 High, 30 Medium, 21 Low)

---

## 4. MANTIKSAL İNCELEME 🧠

Bu bölümde kod değil **iş akışı** inceleniyor. Her akış, sisteme ilk kez oturan bir depo çalışanının gözünden takip edildi.

---

### 4.1 Akış: Yeni kurulum → ilk ürünün girişi

**Adımlar:** Kayıt (ilk admin) → Kategori → Ürün → Varyant → Lokasyon → Stok girişi

**Ne iyi çalışıyor:** Bootstrap akışı düşünülmüş — sistemde kullanıcı yokken `/auth/kayit` açık ve ilk kullanıcı otomatik admin oluyor (`kayitKorumasi.js:11-14`). `db/README.md` bunu belgeliyor. Kategori → Ürün → Varyant hiyerarşisi mantıklı ve her adımda önceki adımın verisi açılır listede geliyor.

**Kullanıcı nerede takılır:**

1. **İlk kullanıcı yaratma ekranı yok.** `POST /auth/kayit` açık ama arayüzde kayıt sayfası yok — `Giris.jsx`'te "kayıt ol" bağlantısı yok, `App.jsx`'te böyle bir rota yok. `Kullanicilar.jsx` bu ucu kullanıyor ama o sayfaya girmek için önce giriş yapmak gerekiyor. **Yani ilk kullanıcı yalnızca `curl` ile yaratılabiliyor.** Bu bir tavuk-yumurta kilidi ve README olmadığı için (Y-22) yeni bir kurulumda çıkış yolu bulunamaz.

2. **"Başlangıç stoğu" tuzağı.** Varyant oluşturma formunda "Başlangıç stoğu" alanı var (`Varyantlar.jsx:256-274`) ve doğal olarak doldurulur. Sonuç Y-02'de anlatıldı: sistem anında "kritik sapma" durumuna düşüyor ve kullanıcı bunu düzeltemiyor. **Yeni kullanıcının yapacağı en olası hata, sistemi bozan hata.**

3. **Lokasyon olmadan giriş yapılamıyor ama bu söylenmiyor.** Stok girişi lokasyon zorunlu kılıyor (`stokHareketiController.js:103-107`). Hiç lokasyon tanımlanmamışsa `LokasyonSecici` boş bir liste gösteriyor — "önce lokasyon tanımlayın" yönlendirmesi yok. Lokasyon yönetimi ise yalnızca admin'e açık ve menüde "Tanımlar" altında, stok akışından uzakta.

**Eksik feature:** Kurulum sihirbazı veya en azından boş durumlarda yönlendirme ("Henüz lokasyon yok · Lokasyon tanımla →"). Boş durum metinleri var ama hepsi bilgilendirici, **hiçbiri eyleme yönlendirmiyor**.

---

### 4.2 Akış: Satınalma siparişi → mal kabul

**Adımlar:** Tedarikçi seç → kalemler → sipariş oluştur → mal gelince "Teslim Al" → lokasyon seç → stok girer

**Ne iyi çalışıyor:** Sipariş oluşturma transaction'lı ve doğrulamalı. Teslim alma çift işlenemiyor. Fiş çıktısı ve WhatsApp paylaşımı pratik bir dokunuş. `bekleyen=1` filtresiyle panel sayacı besleniyor.

**İş akışı doğru mu — hayır, üç noktada gerçek hayattan kopuyor:**

1. **Kısmi teslim yok (Y-13b).** 100 kova sipariş edildi, 60 geldi. Sistemde iki seçenek var: "Teslim Al" (100 girer, **40 hayali kova**) veya hiçbir şey yapma (sipariş sonsuza kadar bekler, stok girmez, gelen 60 kova sistemde yok). İkisi de yanlış. Gerçek bir depoda kısmi teslimat istisna değil **kural**.

2. **Sipariş iptal edilemiyor (Y-13a).** Yanlış açılan bir sipariş kalıcı. Kullanıcının bulacağı çözüm: "Teslim Al"a basıp sonra o stoğu elle çıkışlamak — iki uydurma hareket, bozulmuş denetim izi. Sistem, kullanıcıyı veri bozmaya itiyor.

3. **Tek lokasyona iniyor.** Sipariş 5 farklı ürün içeriyorsa hepsi aynı rafa iniyor (`satinalmaController.js:215-230`). Soğuk oda gerektiren mal ile normal raf malı ayrılamıyor. Kullanıcı sonra elle transfer yapmak zorunda ve bu transferler hiçbir yerde görünmüyor (Y-50).

**Kullanıcı hata yaparsa:** Yanlış lokasyona teslim alındıysa geri alma yolu yok. `TeslimAlModal` onay istiyor ama hangi kalemlerin gireceğini **göstermiyor** (`TeslimAlModal.jsx:29-32`: sadece "#12 numaralı siparişin kalemleri seçtiğin lokasyona eklenecek"). Kullanıcı ne kadar mal gireceğini bilmeden onaylıyor.

**API başarısız olursa:** Toast hata mesajını gösteriyor (`SatinalmaSiparisleri.jsx:193`), sipariş listesi değişmiyor — doğru davranış. Ama `TeslimAlModal` istekten önce kapandığı için (Y-40) kullanıcı hangi sipariş için hata aldığını bağlamdan çıkarmak zorunda.

---

### 4.3 Akış: Satış siparişi → toplama → teslim

**Adımlar:** Müşteri seç → kalemler → sipariş → "Teslim Et" → birim seçimi → stok düşer

**Ne iyi çalışıyor:** Bu, projenin **en olgun akışı**. Birim bazlı toplama gerçek bir WMS davranışı: sistem "şu paletten şu kadar" bilgisini kullanıcıdan alıyor ve sunucu toplamı siparişle iki yönlü doğruluyor (`satisController.js:252-269`). Palet/dökme ayrımı doğru modellenmiş. Kısmi palet tüketimi destekleniyor ve boşalan birim siliniyor.

**Kullanıcı nerede takılır:**

1. **Sipariş anında stok kontrolü yok (DEV-13).** Uyarı var ama bloklamıyor ve verisi bayat (Y-52). Kullanıcı siparişi oluşturuyor, müşteriye söz veriyor, toplama ekranında "yetersiz stok" duvarına çarpıyor. **Sorun, geri dönüşü en pahalı anda ortaya çıkıyor.**

2. **Toplama ekranı elle doldurmayı zorunlu kılıyor (Y-59).** 240 adet 12 palete dağılmışsa 12 input'a elle yazıp toplamın tam tutmasını sağlamak gerekiyor. Bir hesap makinesi işi. Sistem bu dağıtımı hesaplayabilirdi.

3. **"Teslim Et" geri alınamaz ve onay yok (Y-48).** Stok düşüyor, hareket kaydı yazılıyor, sipariş kapanıyor. Yanlış palet seçildiyse düzeltme yolu: elle bir giriş + elle bir çıkış hareketi, ikisi de sahte. Denetim izi bozuluyor.

4. **Toplama listesi yazdırılamıyor.** Kullanıcı ekranda hangi paletten ne alacağını görüyor ama depoya giderken **elinde bir şey yok**. Ekranı ezberlemesi veya tablet taşıması gerekiyor. `Fis` bileşeninin yazdırma altyapısı var (`index.css:1215`), toplama listesine uygulanmamış.

5. **`hazirlaniyor` durumu yok (Y-12).** İki kişi aynı siparişi aynı anda toplamaya başlayabilir. Biri teslim ettiğinde diğeri 409 alıyor — veri güvende ama iş boşa gitmiş.

---

### 4.4 Akış: Sayım

**Ne iyi çalışıyor:** Birim bazlı sayım doğru tasarlanmış. "Listede olmayan ürün ekle" seçeneği (`Sayim.jsx:192-215`) gerçek hayata uygun — beklenmedik mal bulunduğunda sisteme eklenebiliyor. Onay modalı fark özetini gösteriyor (`Sayim.jsx:312-316`) ve "fark yok" durumunu ayrıca belirtiyor. Sunucu tarafı çakışma kontrolleri titiz.

**Mantıksal sorunlar — sayım en riskli akış:**

1. **Sayım sırasında lokasyon kilitli değil (Y-11b).** Kullanıcı ekranı açıp fiziksel sayıma gidiyor (dakikalar). Bu sırada başka biri aynı raftan mal topluyor. Kaydettiğinde sayım, **doğru olan stoğu bozuyor**. Sayım, stok doğruluğunu artırmak yerine azaltabiliyor.

2. **Birim değiştirmek girilen değerleri bozuyor (Y-51).** En tehlikeli tekil UX hatası. Sessiz, geri alınamaz, 10 kat stok kayması üretebilir.

3. **Kısmi sayım semantiği belirsiz (Y-11c).** Boş bırakılan satırlar dokunulmuyor. Fiziksel olarak kaybolmuş bir palet, kullanıcı 0 yazmayı unuttuğu sürece sistemde kalıyor. Arayüzde "tam sayım / kısmi sayım" ayrımı yok, bu davranış hiçbir yerde anlatılmıyor.

4. **Sayım geçmişi yok (Y-11a).** "Bu raf en son ne zaman sayıldı" sorusunun cevabı yok. Döngüsel sayım planlanamıyor.

5. **Sapma düzeltilemiyor.** `LokasyonYonetimi.jsx:193` "Sayım yaparak düzeltebilirsiniz" diyor. Ama Y-02 ile oluşan sapma **hiçbir lokasyona bağlı olmadığı** için sayımla düzeltilemez. Kullanıcı talimatı uyguluyor, sapma duruyor, neden olduğunu anlayamıyor. **Sistem yanlış bir çözüm öneriyor.**

---

### 4.5 Akış: Depo haritası → transfer / paletleme

**Ne iyi çalışıyor:** Görsel harita gerçekten iyi bir fikir ve iyi uygulanmış — kat seçici, doluluk renkleri, lejant, hücreye tıklayınca içerik. Paletleme akışı (dökme → palet) satır içi ve akıcı. Transfer modalı kaynak → hedef okunu gösteriyor.

**Mantıksal sorunlar:**

1. **Transfer iz bırakmıyor (Y-05, Y-50).** Kullanıcı paleti taşıyor, işlem başarılı, sonra "acaba taşıdım mı" diye kontrol edecek yer yok. `StokHareketleri` göstermiyor, ayrı ekran yok. Depo operasyonunda sorumluluk takibi kopuyor.

2. **Kapasite kontrolü yok.** Bir rafa sınırsız palet taşınabiliyor. `healthController` sonradan "kapasite aşımı" diye uyarıyor — yani sistem hatayı **önlemek yerine sonradan raporluyor**. Üstelik `kapasite` alanının anlamı çelişkili (Y-15), yani uyarı da güvenilmez.

3. **Pasif lokasyona transfer engelleniyor ama pasif lokasyondaki stok görünüyor.** `transferController.js:74` hedefin aktif olmasını istiyor (doğru), ama pasif bir lokasyonda stok kalırsa oradan çıkarmanın normal bir yolu yok — ve zaten arayüzde bir lokasyonu pasife alma imkânı da yok (Y-16).

4. **Paletleme sonrası etiket basılamıyor.** Palet kodu üretiliyor ama fiziksel palete yapıştırılacak bir barkod etiketi çıktısı yok. `Pallets.jsx` kod ile sorgulama yapıyor — yani okuma tarafı hazır, **yazma tarafı yok**. Döngü kapanmıyor: kullanıcı kodu elle yazıp elle yapıştırmak zorunda.

---

### 4.6 Akış: Hata durumları ve ağ koşulları

**API başarısız olursa ne oluyor:**

| Durum | Davranış | Değerlendirme |
|---|---|---|
| 401 (token süresi doldu) | `axios.js:24-31` → localStorage temizlenir, `/giris`'e yönlendirilir, `oturumBitti` bayrağı ile bilgi mesajı gösterilir | ✅ **İyi tasarlanmış.** Kullanıcı ne olduğunu anlıyor. |
| 400/409 (iş kuralı hatası) | Toast'ta backend'in mesajı gösteriliyor | ✅ İyi — backend mesajları açıklayıcı yazılmış |
| 403 (yetki yok) | Genel `catch`'e düşüyor, sayfa hata metnine dönüşüyor | ⚠️ `SystemHealth`'te boş sayfa (Y-47) |
| 500 | Üretimde "Sunucu hatası" | ⚠️ Kullanıcı ne yapacağını bilmiyor, `requestId` yok |
| **Ağ kopması** | `error.response` `undefined` → `err.response?.data?.hata` `undefined` → genel mesaj | ⚠️ Çevrimdışı olduğu **söylenmiyor** |
| **İlk yükleme hatası** | Sayfa tek satırlık hata metnine dönüşüyor, kurtarma yok (Y-38) | ❌ **En zayıf nokta** |

**Network yavaşsa ne oluyor:** Yükleme göstergeleri var ve tutarlı (`spinner` + "Yükleniyor..."). Ama:
- İlk yükleme sırasında **tüm sayfa** spinner'a dönüyor; iskelet (skeleton) yok, kullanıcı ne geleceğini bilmiyor
- Çift gönderim koruması eksik olduğu için (Y-39) yavaş ağda kullanıcı butona tekrar basıyor → çift kayıt
- İstek iptali olmadığı için (Y-54) hızlı gezinme yanlış veri gösterebiliyor
- Çevrimdışı algılama yok — `navigator.onLine` veya bir "bağlantı yok" göstergesi hiçbir yerde kullanılmıyor. Depoda Wi-Fi kapsama boşlukları normaldir; kullanıcı isteğin neden başarısız olduğunu anlayamıyor.

**Hiç veri gelmezse:** Boş durum metinleri **tutarlı ve iyi yazılmış** — `bos-durum` sınıfı 14 yerde kullanılmış ve mesajlar bağlama duyarlı: `Varyantlar.jsx:377-379` filtre varsa "Bu filtrelere uyan stok kalemi yok", yoksa "Henüz stok kalemi eklenmemiş". `Urunler.jsx:156-158` arama terimini mesaja koyuyor. Bu, projenin gözden kaçmayan güçlü yanlarından. **Tek eksik:** hiçbiri eyleme yönlendirmiyor (buton veya bağlantı yok).

**Yanlış veri gelirse:** Savunma yok. `Number(v.miktar)` `NaN` üretirse `NaN` render ediliyor. `kalemler` dizi değilse `Fis.jsx:20` fırlatıyor ve ErrorBoundary olmadığı için beyaz ekran (Y-31).

---

### 4.7 Navigation ve genel akıcılık

**Menü yapısı mantıklı:** `Sidebar.jsx:34-93` işlevsel gruplama yapmış — Stok / Satınalma / Satış / Raporlama / Tanımlar. Bir depo çalışanının zihinsel modeline uygun. Rol bazlı filtreleme var. İkonlar anlamlı seçilmiş.

**Sorunlar:**

1. **Sayfalar arası bağ yok.** Bir siparişte "Kırma · 201/230" görülüyor ama o varyanta tıklanamıyor. Bir lokasyonda stok görülüyor ama hareket geçmişine gidilemiyor. Her sayfa bir ada. `Panel.jsx:137` kartları bağlantılı — doğru fikir, ama "Düşük Stok" kartı `/varyantlar`'a filtresiz gidiyor (`sadece_dusuk=1` uygulanmıyor), kullanıcı filtreyi elle kurmak zorunda.

2. **Derin bağlantı (deep link) yok.** Filtreler ve sayfa numarası URL'de tutulmuyor. Kullanıcı 5. sayfaya gidip bir kayda tıklayıp geri döndüğünde 1. sayfada oluyor. Bir aramanın sonucunu meslektaşıyla paylaşamıyor. `useSearchParams` bunu çözerdi ve react-router zaten kurulu.

3. **Geri tuşu tutarsız.** `/` → `/panel` yönlendirmesi `replace` kullanmıyor (Y-46), modallar geçmişe girmiyor (bu doğru), ama filtre değişimleri de girmiyor.

4. **Sayfa başlığı sabit** (Y-53) — tüm sekmelerde "frontend".

---

### 4.8 "Gerçek hayatta kullanılabilir mi?"

**Soru şu şekilde ayrıştırılmalı:**

**Küçük bir zeytin işletmesinde, tek depoda, 2-5 kullanıcıyla, iyi niyetli kullanımda:** **Evet, kullanılabilir.** Temel akışların hepsi çalışıyor: mal girişi, paletleme, transfer, satış, toplama, sayım, raporlama. Veri bütünlüğü korumaları (transaction, `FOR UPDATE`, koşullu `UPDATE`) gerçek ve doğru yazılmış. Bu, çoğu portfolyo projesinin ulaşamadığı bir olgunluk.

**Ancak dört engel var:**

1. **Y-02 kurulumun ilk gününde tetikleniyor.** Yeni kullanıcının yapacağı en doğal hareket (varyant oluştururken başlangıç stoğu girmek) sistemi kalıcı olarak tutarsız duruma sokuyor ve düzeltme yolu yok.

2. **Y-24: bir kullanıcı şifresini unuttuğunda kalıcı olarak kilitleniyor.** Vardiyalı çalışan personelde bu haftalık bir olay ve çözümü veritabanına elle müdahale.

3. **Y-13: satınalma modülü kısmi teslimatı ve iptali desteklemiyor.** Gerçek tedarik zincirinde kısmi teslimat kuraldır. Kullanıcı bunu aşmak için veri uydurmak zorunda kalıyor.

4. **DEV-22/Y-65: sıfır test.** Sistem bugün doğru çalışıyor olabilir; bir sonraki değişiklikten sonra çalışıp çalışmadığını kimse bilemez. Stok yazılımında bu, operasyonel risk.

**Bir e-ticaret senaryosunda (dış sistemden otomatik sipariş akışı):** **Hayır, henüz değil.** İki eksik bunu engelliyor: rezervasyon yok (DEV-13 → aşırı satış kaçınılmaz) ve idempotanlık yok (DEV-15 → webhook/retry çift kayıt üretir). `AUDIT.md:976` bu sıralamayı doğru tespit etmiş.

**Özet:** Sistem "çalışan bir prototip"in ötesine geçmiş, "küçük ölçekte kullanılabilir bir ürün"e yaklaşmış ama henüz varmamış. Aradaki mesafe büyük değil — yukarıdaki dört maddeden ilk üçü toplamda birkaç günlük iş.

---

## 5. MİMARİ ANALİZ 🏗️

### 5.1 Klasör yapısı

**Backend — temiz ve öngörülebilir:**
```
backend/
├── config/      env.js, db.js
├── controllers/ 18 dosya
├── middleware/  auth, izinVer, hataYonetici, kayitKorumasi
├── routes/      19 dosya (index.js + 18)
├── utils/       pagination.js, tarih.js
└── db/          schema.sql, README.md
```
Katman adları açık, her dosya tek bir kaynağa karşılık geliyor, isimlendirme tutarlı. `routes/index.js` merkezi montaj noktası olarak doğru kullanılmış. **Bu yapı bir junior projesinden beklenenin üzerinde.** Eksik olan tek katman `services/` (DEV-23).

**Frontend — düz ve soyutlamasız:**
```
frontend/src/
├── api/         20 dosya (her kaynak için bir modül)
├── components/  8 dosya
├── context/     ToastContext.jsx
├── pages/       18 dosya
├── utils/       tarih.js (6 satır, tek fonksiyon)
└── index.css    1850 satır
```
`hooks/` **yok**, `features/` **yok**, `constants/` **yok**, `types/` **yok**. `utils/` neredeyse boş — 6 satırlık tek bir fonksiyon, oysa kg dönüşümü dört yerde, para biçimlendirme beş yerde tekrarlanıyor (Y-33, Y-56).

**Feature bazlı yapı değerlendirmesi:** Proje katman bazlı (`pages/`, `api/`, `components/`). Bu ölçekte savunulabilir. Ancak sayfalar 500 satıra ulaştığında feature klasörü doğal çözüm olurdu:
```
features/satis/
├── SatisSiparisleri.jsx
├── SiparisFormu.jsx
├── SiparisTablosu.jsx
├── useSatisSiparisleri.js
└── satisApi.js
```
Bu, DEV-31'deki "büyük bileşenler" sorununu yapısal olarak çözer.

### 5.2 Component ayrımı ve yeniden kullanılabilirlik

**Yeniden kullanılan bileşenler (8 adet):** `Etiket` (7 sayfada), `OnayModal` (6 sayfada), `LokasyonSecici` (4 yerde), `Fis` (2 sayfada), `TransferModal`, `TeslimAlModal`, `PickingModal`, `KorumaliRota`.

**Değerlendirme:** `Etiket` ve `OnayModal` iyi soyutlamalar — tek sorumluluk, temiz arayüz, gerçekten yeniden kullanılıyor. `LokasyonSecici` daha iddialı (kat filtresi, blok gruplaması, otomatik temizleme) ve iyi düşünülmüş, ama `l.lokasyon_id || l.id` (satır 73) ile iki farklı veri şeklini idare etmeye çalışıyor — sızıntılı bir soyutlama.

**Çıkarılmamış olması gereken bileşenler:**
- **Sayfalama** — 5 kopya, 19'ar satır (Y-33)
- **Satır içi düzenlenebilir tablo** — 5 kopya, `Musteriler`/`Tedarikciler` neredeyse birebir aynı
- **Yükleme/hata/boş durum kabuğu** — 14 sayfada `if (yukleniyor) ... if (hata) ...` tekrarı
- **Form alanı** — `<div className="form-alan"><label>...</label><input/></div>` deseni yüzlerce kez tekrarlanıyor; tek bir `FormAlani` bileşeni hem tekrarı hem Y-42'deki `htmlFor` eksikliğini tek seferde çözerdi
- **Sipariş formu** — `SatisSiparisleri` ve `SatinalmaSiparisleri` formları %90 aynı

**Oran olarak:** 18 sayfa / 8 bileşen. Sağlıklı bir React projesinde bu oran tersine yakın olur (bileşen sayısı sayfa sayısının 3-5 katı).

### 5.3 State yönetimi ve veri akışı

**Mevcut durum:** Tüm state lokal `useState`. Tek global state `ToastContext`. Redux/Zustand/React Query yok.

**Değerlendirme — bu ölçekte doğru bir karar.** Redux eklemek bu projeye karmaşıklıktan başka bir şey getirmezdi. Ancak iki somut boşluk var:

1. **Sunucu state'i istemci state'i gibi yönetiliyor.** Her sayfa kendi verisini çekiyor, kendi `yukleniyor`/`hata` state'ini tutuyor, önbellek yok, yenileme stratejisi yok, istek tekilleştirme yok. `varyantlariGetir()` beş sayfada ayrı ayrı çağrılıyor (Y-35). Bu tam olarak **TanStack Query**'nin çözdüğü problem ve eklenmesi bu projede yüksek getirili olurdu: önbellek, otomatik yeniden çekme, `isLoading`/`isError`, istek iptali (Y-54), ve mutasyon sonrası ilgili sorguların geçersizleştirilmesi (Y-52). Tek bağımlılık, dört ayrı bulguyu birden kapatır.

2. **Kimlik/oturum bilgisi context'te değil.** `JSON.parse(localStorage.getItem("kullanici"))` **üç ayrı yerde** tekrarlanıyor (`Sidebar.jsx:107`, `LokasyonYonetimi.jsx:49`, `Kullaniciler.jsx:10`), her biri korumasız (Y-31). Bir `AuthContext` bunu tek yerde, `try/catch` ile, ve rol kontrolüyle birlikte çözerdi (Y-47).

**Prop drilling:** Ciddi bir sorun yok — bileşen ağacı sığ (sayfa → modal). En derin geçiş `DepoHaritasi` → `TransferModal`'a 6 prop. Kabul edilebilir. Ancak `lokasyonlar` dizisi `SatinalmaSiparisleri` → `TeslimAlModal` ve `DepoHaritasi` → `TransferModal` yollarında prop olarak taşınıyor; bu veri bir context'te olsaydı hem prop hem tekrar tekrar çekme (Y-35) ortadan kalkardı.

**Gereksiz state:** `Varyantlar.jsx:31-32` — `arama` ve `aranan` ikilisi debounce için gerekli, doğru. `SatisSiparisleri.jsx:21-43` — 15 ayrı `useState`. Bunların 6'sı birbirine bağlı modal durumu (`teslimEdilecek` + `teslimKalemler`, `fisSiparis` + `fisKalemler`, `acikDetay` + `detayKalemler` + `detayYukleniyor`). Bir `useReducer` veya en azından nesne gruplaması okunabilirliği artırırdı.

### 5.4 API katmanı

**Yapı:** `api/axios.js` merkezi istemci + kaynak başına bir modül (20 dosya). Interceptor'lar token ekleme ve 401 yönetimi için doğru kullanılmış.

**İyi olan:** Çağrılar merkezi, `baseURL` tek yerde, token yönetimi bileşenlerden tamamen soyutlanmış, 401 akışı düşünülmüş. Bu katman projenin en temiz kısımlarından.

**Eksikler:**
- **Yanıt şekli sözleşmesi yok.** Backend bazen dizi (`listele`), bazen nesne (`{mesaj, sonuclar}`), bazen `{hata}` dönüyor. İstemci her yerde bunu varsayıyor. TypeScript veya en azından JSDoc tipleri bu sözleşmeyi yazılı hale getirirdi.
- **Hata normalizasyonu yok.** Her çağrı yerinde `err.response?.data?.hata || "varsayılan"` tekrarlanıyor (30+ yerde). Interceptor'da normalize edilip `err.mesaj` olarak sunulabilirdi.
- **Ölü fonksiyonlar:** `urunApi.dusukStokGetir` (var olmayan uç, Y-49), `transferApi.transferleriGetir` (kullanılmıyor, Y-50), `varyantApi.varyantLokasyonlariGetir` (kullanılmıyor).
- **Sayfalama parametreleri tutarsız geçiliyor** — bazı çağrılar `{limit: 1}`, bazıları parametresiz (Y-34).

### 5.5 Utility, sabitler ve config

**Backend:** `utils/pagination.js` ve `utils/tarih.js` — ikisi de küçük, tek sorumluluklu, doğru yazılmış. `pagination.js` üç yerde kullanılmıyor (Y-14), `tarih.js` bir yerde kullanılmıyor (`stokHareketiController` kendi tarih işlemesini yapıyor). **Yani doğru araçlar yazılmış ama tutarlı kullanılmamış.**

`config/env.js` iyi bir örnek: doğrulama + türetilmiş değerler (`uretim`, `corsOrigin`) + hızlı başarısızlık. Bu dosya projenin en olgun parçalarından biri.

**Sabitler:** Backend'de iyi — `GECERLI_ROLLER`, `GECERLI_SEBEPLER`, `MAKS_BLOK_KAYIT`, `MAKS_LIMIT`, `MIN_LENGTH`, `GUN_SAYISI` hepsi adlandırılmış. Frontend'de kısmen — `SAYFA_BOYUTU` beş sayfada **ayrı ayrı** tanımlı (biri 10, dördü 20), `BOS_FILTRE`/`BOS_ALAN`/`BOS_BLOK` iyi kullanılmış, ama renk sabitleri (`Panel.jsx:22-26`) ve durum eşlemeleri (`Etiket.jsx`) dağınık. Ortak bir `constants/` dosyası eksik.

**Config:** `vite.config.js` tamamen varsayılan — `build.rollupOptions` ile manuel chunk ayrımı, `server.proxy` ile geliştirmede CORS'tan kurtulma gibi fırsatlar kullanılmamış.

### 5.6 Tip güvenliği ve bağımlılık yönetimi

**Tip güvenliği yok.** TypeScript kullanılmıyor, JSDoc yok, PropTypes yok. Somut maliyeti bu denetimde görüldü: `l.lokasyon_id || l.id` (iki farklı şekil), `Number(...)` çağrılarının her yere yayılması (DECIMAL string dönüyor), `kalemler` dizisinin şeklinin her yerde varsayılması. `@types/react` kurulu ama yalnızca editör desteği için.

**Öneri:** Tam TS göçü bu boyutta M-L efor. Daha ucuz iki adım: (1) backend'de `zod` (DEV-29) → şemadan tip türet, (2) frontend'de `// @ts-check` + JSDoc ile kademeli tipleme — derleme adımı gerektirmez, editör desteği verir.

**Bağımlılıklar — az ve yerinde seçilmiş:**

*Backend (8 prod):* `express`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `cors`, `helmet`, `express-rate-limit`, `dotenv`. Hiçbiri gereksiz. ORM kullanılmaması bilinçli görünüyor ve ham SQL her yerde parametreli — savunulabilir bir tercih.

*Frontend (6 prod):* `react`, `react-dom`, `react-router-dom`, `axios`, `lucide-react`, `recharts`. `recharts` tek sayfada kullanılıyor ve bundle'ın büyük kısmı (Y-32) — lazy load ile ayrılmalı.

**Eksik olan tek kategori: geliştirme araçları.** Test kütüphanesi yok, backend'de lint yok, Prettier config yok (kod tutarlı biçimlendirilmiş, muhtemelen editör ayarıyla — repoda kayıtlı değil), CI yok, `.nvmrc`/`engines` yok, Docker yok.

### 5.7 Mimari özet değerlendirmesi

**Güçlü yanlar:**
- Backend katmanlaması temiz ve tutarlı
- Veri modeli düşünülmüş — özellikle `stok_birimleri` generated column çözümü
- `config/env.js` ve `middleware/` katmanı olgun
- API istemci katmanı iyi soyutlanmış
- Bağımlılık seçimleri disiplinli
- Türkçe isimlendirme baştan sona **tutarlı** — karışık dil kullanımı yok (birkaç istisna dışında, bkz. Bölüm 9)

**Yapısal eksikler — önem sırasıyla:**
1. Servis katmanı yok (DEV-23) → aynı mantık 3 yerde, kilit sırası tutarsızlığı (Y-01) buradan doğuyor
2. Frontend'de soyutlama katmanı yok (Y-33) → 500 satırlık sayfalar, ağır tekrar
3. Sunucu state yönetimi yok → gereksiz istek, bayat veri, yarış koşulları
4. Test altyapısı yok (DEV-22, Y-65) → diğer tüm iyileştirmelerin önündeki engel
5. Tip sözleşmesi yok → backend-frontend arası varsayımlar yazılı değil

---

## 6. PERFORMANS ANALİZİ ⚡

### 6.1 Ölçülen değerler

```
Bundle (npm run build):
  index.js    788.41 kB  │  gzip: 229.70 kB    ← tek chunk, kod bölme yok
  index.css    24.54 kB  │  gzip:   5.29 kB
  index.html    0.45 kB
Vite uyarısı: "Some chunks are larger than 500 kB after minification."

Lint: 56 problem (48 hata) — 21'i `set-state-in-effect` (basamaklı render)
Memoization: tüm .jsx dosyalarında 1 adet useCallback (ToastContext)
```

### 6.2 Ağ katmanı — en büyük kayıp burada

| Sorun | Yer | Etki |
|---|---|---|
| Panel tüm ürün+varyantları indiriyor | `Panel.jsx:61-62` (Y-34) | **Her oturumun ilk isteği.** 5.000 varyantta MB'larca JSON, sadece `.length` için |
| Sınırsız açılır liste verisi | 5 sayfada `varyantlariGetir()`, `lokasyonlariGetir()` (Y-35) | Sayfa başına ağır istek, önbelleksiz, sayfalar arası tekrar |
| `GET /lokasyonlar` her açılışta tam `GROUP BY` | 5 sayfa (DEV-17) | 5.000 lokasyonda ağır sorgu, 5 kez |
| PickingModal varyant başına ayrı istek | `PickingModal.jsx:24-27` (Y-59) | Klasik N+1, ağ katmanında |
| `dogrula` iki kez → 2 DB sorgusu | Tüm korumalı uçlar (Y-17) | İstek başına %100 fazla auth sorgusu |
| İstek iptali yok | Her yerde (Y-54) | İptal edilmiş isteklerin bant genişliği + yarış |
| Önbellek yok | Her yerde | Sabit veriler (kategoriler, müşteriler) her sayfada yeniden |

### 6.3 Veritabanı katmanı

- **Eksik indeksler (Y-18):** `stok_hareketleri(tarih)` yok → `ORDER BY tarih DESC` her hareket listesi sorgusunda `filesort`. Bu tablo monoton büyüyor; en erken kırılacak nokta.
- **Offset sayfalaması:** `LIMIT ? OFFSET ?` derin sayfalarda tüm önceki satırları tarar. 100.000 hareket ve 500. sayfada pratik olarak açılmaz.
- **Döngü içi sorgu (DEV-18):** 20 birimlik teslimatta 80 sorgu; her biri ağ turu ve kilit tutma süresi.
- **`SELECT v.*`** (`varyantController.js:47`) — gereksiz kolonlar (`olusturulma_tarihi`, `aktif`) her satırda taşınıyor.
- **Sayım sorguları:** `COUNT(*)` ve veri sorgusu ayrı çalışıyor (doğru), ama `COUNT` her sayfa değişiminde tekrar hesaplanıyor. Büyük tablolarda `SQL_CALC_FOUND_ROWS` yerine tahmini sayım veya sayfa 1'de bir kez hesaplama düşünülebilir.

### 6.4 React render katmanı

- **Sıfır memoization.** `SatisSiparisleri.jsx:107-110` — `genelToplam` her render'da tüm kalemler için `kalemHesapla` çalıştırıyor; `kalemHesapla` her çağrıda `varyantlar.find(...)` yapıyor. Kalem listesi render'ı aynı fonksiyonu her kalem için bir kez daha çağırıyor. Her tuş vuruşunda `kalem_sayısı × 2 × varyant_sayısı` dizi taraması.
- **`Sidebar` her render'da `JSON.parse` + `menuGruplari()`** (satır 107, 113). Sidebar her sayfa geçişinde yeniden render oluyor.
- **21 `set-state-in-effect`** — her biri en az bir fazladan render turu.
- **Sanallaştırma yok** — `DepoHaritasi` binlerce buton (Y-62), tablolar sayfalama sayesinde 20 satırla sınırlı (iyi), ama `LokasyonYonetimi` ve `Musteriler`/`Tedarikciler` sayfalanmadığı için 500 satıra kadar DOM'a basıyor (Y-36).
- **Tablo animasyonları** her veri yenilemesinde tekrarlanıyor (Y-60) — CPU maliyeti düşük ama algılanan yavaşlık yüksek.

### 6.5 Bundle ve varlıklar

- **788 kB tek chunk** (Y-32). `recharts` tek sayfada kullanılıyor ve ana bundle'da.
- **`lucide-react`** named import ile tree-shakeable — doğru kullanılmış.
- **`src/assets/hero.png`** — repoda duruyor ama hiçbir yerde import edilmiyor (tarandı). Ölü varlık; build'e girmiyor ama repo boyutunu artırıyor. `react.svg` ve `vite.svg` de kullanılmıyor.
- **Görsel optimizasyonu:** Uygulamada hiç `<img>` yok — tüm görseller SVG ikon. Bu iyi bir tercih ve optimizasyon ihtiyacı doğurmuyor.
- **Font:** Web font yüklenmiyor, sistem fontu kullanılıyor. Performans açısından doğru.

### 6.6 Öncelikli performans aksiyonları

| # | Aksiyon | Efor | Kazanç |
|---|---|---|---|
| 1 | `Panel`'de `limit: 1` + header sayacı (Y-34) | 5 dk | Açılış isteğinde MB'larca veri |
| 2 | `Panel`'i `React.lazy` yap → `recharts` ayrılır (Y-32) | 15 dk | Ana bundle'ın büyük kısmı |
| 3 | Eksik 4 indeks (Y-18) | 30 dk | Hareket/rapor sorgularında filesort |
| 4 | Alt router'lardan `dogrula` temizliği (Y-17) | 20 dk | İstek başına 1 DB sorgusu |
| 5 | Tüm sayfaları `React.lazy` (Y-32) | 1 sa | İlk yükleme süresi |
| 6 | TanStack Query → önbellek + iptal + tekilleştirme | 1 gün | Y-35, Y-52, Y-54'ü birlikte kapatır |
| 7 | `teslimEt`/`sayim` döngülerini topluya çevir (DEV-18) | 4 sa | Kilit süresi, deadlock olasılığı |
| 8 | `DepoHaritasi` sanallaştırma/SVG (Y-62) | 1-2 gün | Büyük depoda kullanılabilirlik |

---

## 7. UI / UX ANALİZİ 🎨

### 7.1 Genel izlenim

`index.css` beklenenden **belirgin şekilde olgun**. CSS değişkenleriyle iki tema, tutarlı `--radius`/`--golge`/renk paleti, tanımlı animasyonlar, ve çoğu junior projede bulunmayan üç detay: `prefers-reduced-motion` desteği, `@media print` kuralları, mobilde tablo yatay kaydırma. Görsel dil baştan sona tutarlı — buton varyantları (`ikincil`, `tehlike`, `ikon-btn`), etiket sistemi, kart sistemi, form düzeni her sayfada aynı.

Bu, projenin en güçlü yanlarından biri ve portfolyoda ilk fark edilecek şey.

### 7.2 Responsive

**Breakpoint'ler:** `max-width: 900px` (sidebar → hamburger menü + perde) ve `max-width: 768px` (formlar dikey, tablolar kaydırılabilir, kartlar küçülür).

**İyi çalışan:** Sidebar mobil davranışı doğru (sabit konum, perde, tıklayınca kapanma — `Sidebar.jsx:135,150`). Form alanları mobilde tam genişliğe geçiyor. Toast konumu mobilde ayarlanmış.

**Sorunlar:**
1. **768-1100px arası boşluk (Y-64).** Tablo yatay kaydırma yalnızca 768px altında etkin. `StokHareketleri` 9 kolonlu; tablet yatay veya küçük dizüstünde tablo taşıyor ve **sayfanın kendisi** yatay kayıyor — sidebar dahil her şey. Depoda tablet yaygın bir cihaz, bu tam hedef kitlede kırılıyor.
2. **`DepoHaritasi` mobilde kullanılamaz.** `gridTemplateColumns: repeat(maxKolon, minmax(52px, 1fr))` — 30 kolonlu bir depo mobilde 1560px genişlik istiyor. Kapsayıcıda `overflow-x` var (`index.css:1560`) ama zoom/pan yok, kullanıcı sürekli kaydırmak zorunda.
3. **Dokunmatik hedef boyutu.** `button { padding: 9px 16px }` → ~35px yükseklik. WCAG 2.5.5 minimum 44×44px öneriyor. `ikon-btn` daha da küçük. Eldivenli elle kullanılan bir depo uygulamasında bu hissedilir.

### 7.3 Boşluk, hizalama, tutarlılık

**Tutarlı:** `--radius: 10px` her yerde, form alanları arası boşluk, tablo hücre padding'i, kart iç boşlukları. Renk kullanımı anlamlı — yeşil giriş, kırmızı çıkış, sarı bekleme.

**Tutarsızlıklar:**
- **Sayfa düzeni her yerde aynı ve bu bir sorun:** başlık → form → (filtre) → tablo. `Varyantlar` sayfasında bu, 8 alanlı bir oluşturma formunun **tablodan önce ve her zaman açık** durması demek — kullanıcı veri görmek için her seferinde kaydırıyor. Form bir modal veya katlanabilir panel olmalı. `LokasyonYonetimi` en uç örnek: **iki büyük form** (8 + 10 alan) tablodan önce, liste ekranın çok altında.
- `SAYFA_BOYUTU` sayfalara göre farklı (10 vs 20) — kullanıcı için tutarsız.
- Bazı tablolarda "İşlemler", bazılarında "İşlem" başlığı.
- `Kategoriler.jsx:70-78` ve `Tedarikciler.jsx:105-138` formları `form-alan`/`label` yapısını kullanmıyor, yalnızca `placeholder` ile çalışıyor — diğer sayfalarla görsel olarak farklı ve erişilebilirlik açısından daha zayıf.

### 7.4 Durum gösterimleri

| Durum | Değerlendirme |
|---|---|
| **Loading** | ✅ Tutarlı `spinner` + "Yükleniyor...". Ama tüm sayfa kapsanıyor, iskelet yok. Modal içi yükleme de var (`PickingModal.jsx:119-123`) — iyi. |
| **Empty** | ✅ **En güçlü nokta.** 14 yerde `bos-durum`, mesajlar bağlama duyarlı (filtre var/yok, arama terimi dahil). Eksik: eyleme yönlendirme. |
| **Error** | ❌ **En zayıf nokta.** Sayfa tamamen hata metnine dönüşüyor, kurtarma yok (Y-38). |
| **Disabled** | ⚠️ Kısmen. `Urunler.jsx:232` ve `Kategoriler.jsx:100` silme butonunu `disabled` + açıklayıcı `title` ile devre dışı bırakıyor — **çok iyi bir detay**. Ama sipariş formlarında gönderim sırasında disabled yok (Y-39). |
| **Hover** | ✅ Var, ama `tr:hover { translateX(4px) }` veri tablosunda rahatsız edici (Y-60). |
| **Active/Focus** | ⚠️ Input/select için özel odak stili var ve iyi. **Buton için yok** (Y-42) — klavye kullanıcısı odağı takip edemiyor. `NavLink` aktif durumu var. |
| **Success** | ✅ Toast ile tutarlı geri bildirim. Ama 3 sn sabit ve kapatılamıyor (Y-57). |

### 7.5 Renk kontrastı ve tipografi

**Kontrast (hesaplandı):**
- Koyu tema ana metin `#e2e8f0` / `#0f172a` → ~14.8:1 ✅ AAA
- Koyu tema soluk metin `#94a3b8` / `#1e293b` → ~6.2:1 ✅ AA
- Açık tema soluk metin `#64748b` / `#ffffff` → ~4.8:1 ✅ AA (sınırda)
- Buton metni beyaz / `#6366f1` → ~4.6:1 ✅ AA (sınırda)

Kontrast oranları geçiyor. **Asıl sorun boyut:** `.kucuk-not` 11px ve kritik bilgi taşıyor (Y-61). Tablo başlıkları 12px + `uppercase` + `letter-spacing` — estetik ama okunabilirliği düşürüyor.

**Renk tek başına anlam taşıyan yerler:**
- `DepoHaritasi` doluluk durumu (lejant var ✅, ama hücrede metin yok)
- `fark-arti` / `fark-eksi` — `+`/`-` işareti de var ✅ doğru
- `Etiket` — metin de içeriyor ✅ doğru

### 7.6 Öne çıkan UX kararları — olumlu

Bunlar özellikle not edilmeli, çünkü deneyim gerektiren detaylar:
- **Silme butonunun bağımlılık varken `disabled` + açıklayıcı `title` olması** (`Urunler.jsx:232-238`) — kullanıcı hatayı yapmadan önce öğreniyor
- **Boş durum mesajlarının filtre varlığına göre değişmesi**
- **Onay modalının somut sayı içermesi** (`Sayim.jsx:315`: "3 birimde fark tespit edildi")
- **kg ↔ adet dönüşümünün canlı gösterilmesi** (`= 24.00 adet`) — kullanıcı ne girdiğini anlıyor
- **Oturum sona erdiğinde bilgi mesajı** (`Giris.jsx:19-22`) — sessizce atılmıyor
- **Şifre göster/gizle butonu**
- **`Fis` için ayrı print CSS'i** — sadece fiş basılıyor
- **`prefers-reduced-motion` desteği**

### 7.7 Öncelikli UI/UX aksiyonları

| # | Aksiyon | Bulgu |
|---|---|---|
| 1 | Hata durumunu banner yap, sayfayı koru, "Tekrar dene" ekle | Y-38 |
| 2 | Riskli işlemlere onay (rol değişimi, blok üretimi, teslim etme) | Y-48 |
| 3 | `<label>` bağlantısı + toast `aria-live` + buton `:focus-visible` | Y-42 |
| 4 | Modal: Escape + odak tuzağı + veri kaybı uyarısı | Y-41 |
| 5 | Oluşturma formlarını modal/katlanabilir panele taşı | 7.3 |
| 6 | Tablo yatay kaydırmayı breakpoint dışına çıkar | Y-64 |
| 7 | Grafikleri temaya bağla | Y-43 |
| 8 | `.kucuk-not` 12-13px, kritik uyarılar için ayrı sınıf | Y-61 |
| 9 | Boş durumlara eylem butonu ekle | 4.6 |
| 10 | Toplama ekranına "Otomatik doldur" | Y-59 |
