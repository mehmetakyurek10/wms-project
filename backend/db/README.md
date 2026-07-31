# Veritabanı

`schema.sql` dosyası mevcut şemanın (tablo yapıları, kısıtlar, indeksler) dışa aktarılmış halidir. Veri içermez.

## Sıfırdan kurulum

```bash
mysql -u root -e "CREATE DATABASE wms;"
mysql -u root wms < backend/db/schema.sql
```

Ardından uygulamayı başlatıp ilk kullanıcıyı oluşturun — sistemde hiç kullanıcı yokken
`POST /auth/kayit` açıktır ve oluşturulan ilk kullanıcı otomatik olarak `admin` rolünü alır.

## Şema güncellendiğinde

Şemada değişiklik yaptıktan sonra bu dosyayı yeniden üretin:

```bash
mysqldump -u root --no-data --skip-comments --set-gtid-purged=OFF wms > backend/db/schema.sql
```

> Not: Şu an versiyonlanmış migration altyapısı yok, değişiklikler elle uygulanıyor.
> Bu dosya bir anlık görüntüdür, değişiklik geçmişi tutmaz.
