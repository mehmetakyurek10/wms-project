# WMS — Depo Yönetim Sistemi

Zeytin toptancılığı için geliştirilmiş depo yönetim sistemi. Stok takibi, palet yönetimi, satınalma ve satış siparişleri, lokasyon bazlı depo haritası ve raporlama içerir.

**Yığın:** Express 5 + MySQL 8 (backend) · React 19 + Vite (frontend)

---

## Kurulum

### Gereksinimler

- Node.js 20.6 veya üstü (`--env-file` desteği için)
- MySQL 8.0.19 veya üstü

### 1. Depoyu klonla

```bash
git clone <depo-adresi>
cd wms-projesi
```

### 2. Veritabanını kur

```bash
mysql -u root -e "CREATE DATABASE wms;"
mysql -u root wms < backend/db/schema.sql
```

Testleri de çalıştıracaksan ikinci bir veritabanı gerekiyor:

```bash
mysql -u root -e "CREATE DATABASE wms_test;"
```

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
```

`.env` dosyasını doldur (aşağıdaki tabloya bakınız). `JWT_SECRET` için:

```bash
openssl rand -base64 48
```

Sonra başlat:

```bash
npm run dev
```

API `http://localhost:3000` üzerinde çalışır.

### 4. Frontend

Yeni bir terminalde:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Arayüz `http://localhost:5173` üzerinde açılır.

### 5. İlk kullanıcı

Sistemde hiç kullanıcı yokken `POST /auth/kayit` ucu açıktır ve oluşturulan **ilk kullanıcı otomatik olarak `admin` rolü alır**. Arayüzdeki kayıt ekranından ya da doğrudan:

```bash
curl -X POST http://localhost:3000/auth/kayit \
  -H "Content-Type: application/json" \
  -d '{"ad":"Adınız","email":"siz@ornek.com","sifre":"guclu-bir-sifre"}'
```

İlk kullanıcı oluştuktan sonra bu uç kapanır; yeni kullanıcı ancak admin tarafından eklenebilir.

---

## Ortam değişkenleri

### `backend/.env`

| Değişken | Açıklama |
|---|---|
| `NODE_ENV` | `development` / `production` — üretimde hata detayları gizlenir |
| `PORT` | API portu (varsayılan 3000) |
| `DB_HOST` | MySQL sunucusu |
| `DB_USER` | MySQL kullanıcısı |
| `DB_PASSWORD` | MySQL parolası |
| `DB_NAME` | Veritabanı adı |
| `DB_PORT` | MySQL portu (varsayılan 3306) |
| `DB_POOL_SIZE` | Bağlantı havuzu boyutu (varsayılan 20) |
| `JWT_SECRET` | Token imzalama anahtarı — **en az 32 karakter** |
| `CORS_ORIGIN` | İzinli kaynaklar, virgülle ayrılmış |

Uygulama açılışta bu değişkenleri doğrular. Zorunlu biri eksikse ya da `JWT_SECRET` kısaysa **başlamaz** — hatalı yapılandırmayla çalışmaktansa açıkça durmak tercih edilmiştir.

### `frontend/.env`

| Değişken | Açıklama |
|---|---|
| `VITE_API_URL` | Backend adresi, örn. `http://localhost:3000` |

> **Uyarı:** `VITE_` önekli değişkenler build sırasında JS paketinin içine gömülür ve tarayıcıdan okunabilir. Buraya parola, anahtar veya gizli bilgi konmaz.

---

## Komutlar

### Backend

| Komut | Ne yapar |
|---|---|
| `npm run dev` | nodemon ile geliştirme sunucusu |
| `npm start` | production sunucusu |
| `npm test` | testleri `wms_test` veritabanında çalıştırır |

### Frontend

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Vite geliştirme sunucusu |
| `npm run build` | üretim derlemesi (`dist/`) |
| `npm run preview` | derlenmiş sürümü önizle |
| `npm run lint` | ESLint |

---

## Testler

```bash
cd backend
cp .env.test.example .env.test   # yoksa .env.example'dan türet, DB_NAME=wms_test yap
npm test
```

Testler **yalnızca `wms_test` veritabanında** çalışır. `DB_NAME` başka bir değerse test başlamadan hata verir — bu, gerçek veriye yanlışlıkla dokunmayı engelleyen bir emniyet kontrolüdür.

Her çalıştırmada şema sıfırdan kurulur. Kapsam:

- **Stok değişmezi** — mal kabul, paletleme, transfer, fire, satış ve sayım akışları sırayla çalıştırılır; her adımdan sonra `SUM(stok_birimleri.miktar) == SUM(urun_varyantlari.miktar)` doğrulanır
- **Yarış durumu** — aynı satınalma siparişine eşzamanlı iki teslim alma isteği gönderilir; stoğun bir kez arttığı ve deftere tek hareket yazıldığı doğrulanır
- **Rezervasyon** — ayrılan stoğun fiziksel miktara dokunmadığı, kullanılabilirin üstünde rezervasyon yapılamadığı, rezerve malın çıkış/paletleme/transfer ile tüketilemediği, paletin bütün olarak taşınabildiği, siparişin iptalinin rezervasyonu serbest bıraktığı
- **Oturum** — refresh çerezinin `HttpOnly` ve `Path=/auth` olarak basıldığı, refresh token'ın API isteğinde kabul edilmediği, yenilemede çerezin döndürüldüğü, çıkışın çerezi sildiği, şifre değişiminde eski token'ın düştüğü ama kullanıcının kendi oturumunun sürdüğü
- **Yetkilendirme** — on altı ucun token'sız erişime kapalı olduğu, depo sorumlusunun admin uçlarına ve kullanıcı kaydına erişemediği, günlük işlem uçlarına erişebildiği
- **Sistem sağlığı** — sağlık ucunun veritabanı bağlantısını doğru bildirdiği, ilk kullanıcının admin olduğu

Arayüz testi yoktur; frontend elle doğrulanır.

---

## Mimari

```
backend/
  app.js                 Express uygulaması (port açmaz, testler bunu kullanır)
  index.js               sunucuyu başlatır, graceful shutdown
  config/
    db.js                mysql2 bağlantı havuzu
    env.js               açılışta ortam değişkeni doğrulaması
  middleware/
    auth.js              access token'ı çözer, türünü ve sürümünü doğrular
    izinVer.js           rol bazlı yetkilendirme
    hataYonetici.js      merkezî hata yakalayıcı
    kayitKorumasi.js     ilk kurulum dışında kayıt ucunu kapatır
  routes/                uç nokta tanımları
  controllers/           iş mantığı ve SQL
  utils/
    tokens.js            token üretimi ve refresh çerezi ayarları
    tarih.js             yerel tarih ve yarı açık aralık yardımcıları
    pagination.js        sayfalama
    reservations.js      rezerve miktar hesabı
  db/schema.sql          veritabanı şeması (veri içermez)
  tests/                 test dosyaları ve yardımcıları

frontend/src/
  api/
    axios.js             istek/yanıt ara katmanları, sessiz token yenileme
    tokenStore.js        access token'ın bellekteki tek kopyası
    *.js                 uç nokta sarmalayıcıları
  context/
    authContext.js       oturum context nesnesi
    AuthProvider.jsx     açılışta oturumu çerezden geri kurar
    ToastContext.jsx     bildirim sağlayıcısı
  hooks/
    useAuth.js           oturuma erişim
    useFetch.js          veri çekme, ilk yükleme ve yeniden çekme ayrımı
  pages/                 sayfa bileşenleri
  components/            paylaşılan bileşenler
  utils/                 tarih yardımcıları
  styles/                konuya göre ayrılmış stil dosyaları
  index.css              yalnızca stil dosyalarını sırayla içe aktarır
```

### Yetkilendirme

`routes/index.js` içinde `/auth` dışındaki **tüm** yönlendiriciler `dogrula` ara katmanının arkasındadır. Yeni bir yönlendirici eklendiğinde ayrıca korumaya alınması gerekmez — varsayılan korumalıdır. Bazı uçlar ek olarak `izinVer("admin")` ister.

### Stok modeli

Stok **iki katmanda** tutulur:

- `urun_varyantlari.miktar` — varyantın toplam miktarı
- `stok_birimleri` — miktarın fiziksel birimlere dağılımı

`stok_birimleri` her fiziksel taşıma birimini ayrı satır olarak tutar:

| `tip` | Anlamı |
|---|---|
| `palet` | Barkodu olan fiziksel palet (`kod` alanı dolu) |
| `dokme` | Barkodu olmayan, lokasyonda serbest duran mal |

Palet başına miktar sabit değildir — aynı üründen bir palette 75, diğerinde 80 kova olabilir. Her palet kendi miktarını taşıdığı için palet sayısı bölme işlemiyle tahmin edilmez, doğrudan sayılır.

Dökme stokta aynı varyant + lokasyon çifti için yalnızca bir satır bulunabilir; bu, üretilmiş bir kolon üzerindeki `dokme_tek` UNIQUE indeksiyle zorunlu kılınmıştır. Paletlerde böyle bir kısıt yoktur, aynı üründen aynı yerde birden fazla palet olabilir.

### Rezervasyon

Satış siparişi oluşturulurken stok **ayrılır**: kullanıcı hangi paletten ve dökmeden kaç adet çıkacağını seçer, seçim `stok_rezervasyonlari` tablosuna birim bazında yazılır. Böylece aynı mal iki siparişe birden satılamaz.

Rezervasyon `stok_birimleri.miktar` alanına **dokunmaz**. Sorgulamada iki ayrı büyüklük vardır:

```
kullanilabilir = miktar - rezerve
```

Ayrım bilinçlidir: rezervasyon bir *söz*, stok bir *gerçeklik*tir. Rezerve edileni fiziksel miktardan düşseydik depoyu sayan kişinin gördüğü sayı ile sistemin gösterdiği sayı ayrışırdı — bir depo yönetim sisteminin varlık sebebi tam olarak bu ikisinin örtüşmesidir.

Bunun pratik sonuçları:

| İşlem | Rezerve edilmiş stok için |
|---|---|
| Çıkış, paletleme, dökme transfer | Engellenir — yalnızca kullanılabilir tüketilebilir |
| Paletin bütün olarak taşınması | Serbest — rezervasyon `birim_id`'ye bağlı olduğu için paletle birlikte taşınır |
| Sayım | **Engellenmez** |

Sayımın engellenmemesi bilinçli bir tercihtir. Sayımda rezerveden az mal bulunursa kayıt yine de kabul edilir; çelişki sistem sağlığı ekranında `karsilanamayan_rezervasyon` olarak görünür ve ilgili siparişin teslimatı `409` ile reddedilir. Sayımı reddetmek, gerçekte olan bir farkı sisteme hiç girilmemiş hale getirirdi. Doğru davranış çelişkiyi yutmak ya da engellemek değil, **görünür kılmaktır**.

### İşlem güvenliği

Stok değiştiren tüm akışlar aynı kalıbı izler:

1. `beginTransaction` öncesinde doğrulama
2. `SELECT ... FOR UPDATE` ile kilitleme
3. Koşullu `UPDATE` (`WHERE ... AND miktar >= ?`) — `affectedRows === 0` ise `409`
4. `try/finally` ile bağlantının her koşulda havuza dönmesi

Birden fazla satır kilitlenecekse **her zaman aynı ölçüte göre sıralı** kilitlenir (`ORDER BY id` / `ORDER BY lokasyon_id`). Bu, karşılıklı transferlerde deadlock oluşmasını yapısal olarak engeller.

### Oturum yönetimi

İki ayrı token kullanılır ve ikisi de JWT'dir:

| | Ömür | Nerede durur | Ne işe yarar |
|---|---|---|---|
| **Access token** | 15 dakika | Tarayıcı belleğinde (`tokenStore.js`) | Her API isteğinde `Authorization` başlığıyla gider |
| **Refresh token** | 7 gün | `HttpOnly` çerez, `Path=/auth` | Yalnızca yeni access token almak için kullanılır |

Access token hiçbir zaman `localStorage`'a veya `sessionStorage`'a yazılmaz. Sayfa yenilendiğinde bellekle birlikte kaybolur; oturum, tarayıcıda duran refresh çerezinden geri kurulur (`AuthProvider.jsx`). Refresh token ise JavaScript'ten okunamaz — `HttpOnly` olduğu için bir XSS açığı bile ona erişemez.

Çerezin `Path=/auth` olması, refresh token'ın günlük trafiğin hiçbirinde ağa çıkmamasını sağlar; yalnızca `/auth/*` uçlarına gönderilir.

Token türleri `tip` claim'iyle ayrılır. Bir refresh token'ı `Authorization` başlığına koyup API'ye erişmek mümkün değildir, tersi de öyle.

Access token'ın süresi dolduğunda istek `401` alır; `axios.js` içindeki yanıt ara katmanı bunu yakalar, `/auth/yenile` çağırır ve isteği tekrarlar. Kullanıcı bir şey fark etmez. Eşzamanlı olarak `401` alan istekler **tek bir** yenilemeyi paylaşır (tek uçuş) — aksi halde her biri ayrı yenileme başlatır ve çerez döndürme yarışa girerdi.

Her yenilemede refresh çerezi yenisiyle değiştirilir (rotation), böylece ele geçirilmiş bir refresh token'ın ömrü kısalır.

`kullanicilar.token_surumu` alanı her iki token'ın içeriğine gömülür ve her istekte karşılaştırılır. Parola değiştiğinde bu sürüm artar; diğer cihazlardaki oturumlar anında geçersiz olur. Parolayı değiştiren kullanıcıya yeni bir access token ve yeni bir refresh çerezi verilir, kendi oturumu kesilmez.

Çıkış yapıldığında sunucu refresh çerezini siler. Elde kalmış bir access token en fazla 15 dakika daha yaşar ve yenilenemez.

> **Dağıtım notu:** CSRF koruması çerezin `SameSite=Lax` ayarına dayanır. Bu, frontend ve backend'in aynı sitede sunulduğu kurulumlar için yeterlidir (geliştirmede `localhost:5173` ile `localhost:3000` aynı sitedir — port, site tanımına dahil değildir). İkisi farklı alan adlarına taşınırsa çerez `SameSite=None` olmak zorunda kalır ve o noktada ayrıca CSRF token'ı gerekir.

---

## Modüller

| Modül | İçerik |
|---|---|
| **Panel** | Özet kartlar, son 14 gün giriş/çıkış grafiği, en çok hareket gören kalemler, bölge bazlı dağılım |
| **Ürünler / Stok Kalemleri** | Ürün ve varyant tanımları (boy, ambalaj tipi, ambalaj kg, barkod, kritik seviye) |
| **Depo Haritası** | Kuş bakışı yerleşim planı, kat katmanları, lokasyon detayı, paletleme ve taşıma |
| **Palet Sorgula** | Barkod ile palet arama, depodaki paletlerin listesi |
| **Stok Hareketleri** | Giriş/çıkış kaydı, birim seçimi, filtreleme ve sayfalama |
| **Sayım** | Lokasyon bazlı sayım; her palet ve dökme yığın ayrı satır |
| **Satınalma** | Sipariş oluşturma, teslim alma, fiş |
| **Satış** | Sipariş oluşturma, birim bazlı toplama, teslim, iptal, fiş |
| **Lokasyonlar** | Lokasyon tanımları ve blok üreteci |
| **Raporlar** | Tarih aralığına göre hareket özeti, çalışan ve kalem kırılımı |
| **Sistem Sağlığı** | Stok sapması, negatif stok, pasif lokasyonda stok, kapasite aşımı kontrolleri |
| **Kullanıcılar** | Kullanıcı yönetimi, rol atama, parola değiştirme |

### Roller

| Rol | Yetki |
|---|---|
| `admin` | Tüm işlemler, kullanıcı ve lokasyon yönetimi, sistem sağlığı |
| `depo_sorumlusu` | Stok işlemleri, siparişler, sayım, transfer |

### Lokasyon adresleme

Palet yerleri `R-01-02-K1` biçiminde adreslenir:

| Parça | Anlam |
|---|---|
| `R` | Blok / yön |
| `01` | Sıra |
| `02` | Derinlik |
| `K1` | Kat |

Kat bilgisi kuş bakışı planda gösterilemediği için haritada katman geçişi olarak sunulur.

---

## Şema değişiklikleri

Versiyonlanmış migration altyapısı henüz yoktur; değişiklikler elle uygulanır. Şemada değişiklik yaptıktan sonra dosyayı yeniden üret:

```bash
mysqldump -u root --no-data --skip-comments --set-gtid-purged=OFF wms > backend/db/schema.sql
```

Şema değişikliğinden önce mutlaka yedek al:

```bash
mysqldump -u root wms > ~/wms-yedek-$(date +%Y%m%d-%H%M).sql
```

---

## Bilinen sınırlar

- **Şema tabanlı girdi doğrulaması yok.** Doğrulama her denetleyicide elle yapılır.
- **Versiyonlanmış migration yok.** `schema.sql` bir anlık görüntüdür, değişiklik geçmişi tutmaz.
- **Servis katmanı yok.** SQL, iş kuralı ve HTTP aynı denetleyici fonksiyonunda bulunur.
- **Sunucu tarafı idempotanlık yok.** Çift gönderim arayüzde buton kilidiyle, çift işleme ise koşullu `UPDATE`'lerle engellenir. Ağ kopması sonrası otomatik tekrar için işlem anahtarı (idempotency key) mekanizması yoktur; el terminali kullanılmaya başlandığında gerekecektir.
- **Satış fiyatı sunucuda doğrulanmaz.** Sipariş toplamı istemciden gelen birim fiyatla hesaplanır; varyantın kayıtlı fiyatıyla karşılaştırılmaz.
- **Arayüz testi yok.** Backend akışları otomatik test edilir, frontend elle doğrulanır.
- **Stil dosyaları konuya göre ayrıldı ama içerik yeniden düzenlenmedi.** `styles/` altındaki dosyalar özgün sırayı birebir korur; bu yüzden açık tema kuralları ve medya sorguları hâlâ birden fazla dosyaya dağılmış durumdadır.
- **Panel ekranının paketi büyük.** Sayfalar tembel yüklendiği için ilk açılış hafiftir, ancak panel grafik kütüphanesiyle birlikte yaklaşık 390 kB'lık ayrı bir paket oluşturur. Yalnızca panele girildiğinde iner.
