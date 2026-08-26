# Veritabanı

Bu klasör şemanın iki farklı temsilini barındırıyor:

- **`schema.sql`** — güncel şemanın anlık görüntüsü. Tablo yapıları, kısıtlar, indeksler
  ve uygulanmış migration kayıtları. Uygulama verisi içermez. Sıfırdan kurulum ve testler
  bunu kullanır.
- **`migrations/`** — sıralı, tek seferlik şema değişiklikleri. Mevcut bir veritabanını
  ilerletir, değişiklik geçmişini taşır.
- **`migrate.js`** — uygulanmamış migration'ları sırayla çalıştıran araç.

Kurulum adımları, komut listesi ve şema değiştirme yöntemi kök `README.md` dosyasında
anlatılıyor. Aşağıdakiler yalnızca bu klasöre özgü notlar.

## Anlık görüntüyü yenileme

Bir migration ekledikten sonra `schema.sql` **iki komutla** yeniden üretilir:

```bash
mysqldump -u root --no-data --skip-comments --set-gtid-purged=OFF wms > backend/db/schema.sql
mysqldump -u root --no-create-info --skip-comments --set-gtid-purged=OFF wms schema_migrations >> backend/db/schema.sql
```

İkinci komut şart. Atlanırsa `schema_migrations` tablosu dosyada boş kalır ve şu zincir
işler: `schema.sql` ile kurulum yapan biri sonra `npm run migrate` çalıştırır, çalıştırıcı
hiçbir sürümü uygulanmış saymaz, baştan başlar ve zaten var olan bir indeksi yeniden
oluşturmaya çalışır — `ER_DUP_KEYNAME` ile durur.

## Migration yazarken

MySQL'de `ALTER TABLE` gibi ifadeler örtük commit üretir; bir migration yarıda kalırsa
geri alınamaz. Her dosyayı tek bir mantıksal değişiklikle sınırlı tut ve çalıştırmadan
önce yedek al.
