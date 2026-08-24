ALTER TABLE satinalma_siparisleri
  ADD COLUMN iptal_tarihi DATETIME DEFAULT NULL,
  ADD COLUMN iptal_aciklamasi VARCHAR(255) DEFAULT NULL,
  ADD COLUMN iptal_eden_kullanici_id INT DEFAULT NULL,
  ADD CONSTRAINT fk_satinalma_iptal_eden
    FOREIGN KEY (iptal_eden_kullanici_id) REFERENCES kullanicilar (id);