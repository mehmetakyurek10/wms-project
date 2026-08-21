CREATE TABLE sayimlar (
  id INT NOT NULL AUTO_INCREMENT,
  lokasyon_id INT NOT NULL,
  olusturan_kullanici_id INT DEFAULT NULL,
  tarih DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aciklama VARCHAR(255) DEFAULT NULL,
  sayilan_kalem INT NOT NULL DEFAULT 0,
  farkli_kalem INT NOT NULL DEFAULT 0,
  net_fark DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  KEY idx_sayim_lokasyon (lokasyon_id),
  KEY idx_sayim_tarih (tarih),
  CONSTRAINT fk_sayim_lokasyon FOREIGN KEY (lokasyon_id) REFERENCES lokasyonlar (id),
  CONSTRAINT fk_sayim_kullanici FOREIGN KEY (olusturan_kullanici_id) REFERENCES kullanicilar (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

ALTER TABLE stok_hareketleri
  ADD COLUMN sayim_id INT DEFAULT NULL,
  ADD KEY idx_hareket_sayim (sayim_id),
  ADD CONSTRAINT fk_hareket_sayim FOREIGN KEY (sayim_id) REFERENCES sayimlar (id);