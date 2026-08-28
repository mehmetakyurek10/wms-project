#!/usr/bin/env bash
set -euo pipefail

# Cron betigi baska bir dizinden calistirabilir; proje kokune sabitleniyor.
KOK="$(cd "$(dirname "$0")/.." && pwd)"
cd "$KOK"

MOD="${1:-yerel}"
HEDEF="${WMS_YEDEK_DIZINI:-$HOME/wms-yedekler}"
SAKLAMA="${WMS_YEDEK_SAKLAMA:-14}"
DAMGA="$(date +%Y%m%d-%H%M%S)"
DOSYA="$HEDEF/wms-$DAMGA.sql.gz"

mkdir -p "$HEDEF"

# --single-transaction: InnoDB'de tablolari kilitlemeden tutarli goruntu alir,
# boylece depo calisirken yedek alinabilir.
if [ "$MOD" = "docker" ]; then
  KOK_PAROLA=""
  VERITABANI="wms"

  if [ -f .env ]; then
    KOK_PAROLA="$(grep -E '^DB_ROOT_PASSWORD=' .env | cut -d= -f2- || true)"
    ENV_DB="$(grep -E '^DB_NAME=' .env | cut -d= -f2- || true)"
    [ -n "$ENV_DB" ] && VERITABANI="$ENV_DB"
  fi

  # Parola MYSQL_PWD ile veriliyor: -p ile verilseydi konteyner icindeki
  # surec listesinde acikca gorunurdu.
  docker compose exec -T -e MYSQL_PWD="$KOK_PAROLA" db mysqldump \
    --single-transaction --routines --triggers --set-gtid-purged=OFF \
    -u root "$VERITABANI" | gzip >"$DOSYA"
else
  mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF \
    -u "${DB_USER:-root}" "${DB_NAME:-wms}" | gzip >"$DOSYA"
fi

BOYUT="$(wc -c <"$DOSYA" | tr -d ' ')"

# Bos ya da kirpilmis bir dosya sessizce "yedek alindi" sayilmamali.
if [ "$BOYUT" -lt 1024 ]; then
  rm -f "$DOSYA"
  echo "HATA: yedek olusmadi ya da cok kucuk ($BOYUT bayt)" >&2
  exit 1
fi

find "$HEDEF" -name "wms-*.sql.gz" -type f -mtime +"$SAKLAMA" -delete

echo "Yedek alindi: $DOSYA ($(du -h "$DOSYA" | cut -f1))"
echo "Saklanan yedek sayisi: $(find "$HEDEF" -name 'wms-*.sql.gz' | wc -l | tr -d ' ')"