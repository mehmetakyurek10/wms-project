CREATE INDEX idx_hareket_tarih ON stok_hareketleri (tarih);
CREATE INDEX idx_hareket_varyant_tarih ON stok_hareketleri (varyant_id, tarih);
CREATE INDEX idx_satis_tarih ON satis_siparisleri (siparis_tarihi);
CREATE INDEX idx_satinalma_tarih ON satinalma_siparisleri (siparis_tarihi);