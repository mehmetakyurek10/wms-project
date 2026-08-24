ALTER TABLE urun_varyantlari DROP COLUMN perakende_fiyat;

ALTER TABLE pazar_seferleri ADD COLUMN hasilat DECIMAL(12, 2) DEFAULT NULL;