
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `kategoriler`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kategoriler` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ad` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ad` (`ad`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `kullanicilar`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kullanicilar` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ad` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `sifre_hash` varchar(255) NOT NULL,
  `rol` enum('admin','depo_sorumlusu') NOT NULL DEFAULT 'depo_sorumlusu',
  `olusturulma_tarihi` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `aktif` tinyint(1) NOT NULL DEFAULT '1',
  `token_surumu` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `lokasyonlar`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lokasyonlar` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kod` varchar(20) NOT NULL,
  `ad` varchar(100) DEFAULT NULL,
  `tip` enum('palet','raf','alan','kabul','sevkiyat','soguk_oda','koridor','ofis','pazar') NOT NULL DEFAULT 'palet',
  `satir` int NOT NULL,
  `kolon` int NOT NULL,
  `kapasite` decimal(12,2) NOT NULL DEFAULT '0.00',
  `aktif` tinyint(1) NOT NULL DEFAULT '1',
  `blok` varchar(10) DEFAULT NULL,
  `sira` int DEFAULT NULL,
  `derinlik` int DEFAULT NULL,
  `kat` int NOT NULL DEFAULT '1',
  `satir_span` int NOT NULL DEFAULT '1',
  `kolon_span` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `kod` (`kod`),
  UNIQUE KEY `konum` (`satir`,`kolon`,`kat`)
) ENGINE=InnoDB AUTO_INCREMENT=276 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `musteriler`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `musteriler` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ad` varchar(100) NOT NULL,
  `yetkili_kisi` varchar(100) DEFAULT NULL,
  `telefon` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `adres` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `pazar_sefer_kalemleri`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pazar_sefer_kalemleri` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sefer_id` int NOT NULL,
  `varyant_id` int NOT NULL,
  `giden_miktar` decimal(12,2) NOT NULL,
  `donen_miktar` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sefer_varyant_tek` (`sefer_id`,`varyant_id`),
  KEY `sefer_kalem_varyant_idx` (`varyant_id`),
  CONSTRAINT `fk_sefer_kalem_sefer` FOREIGN KEY (`sefer_id`) REFERENCES `pazar_seferleri` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sefer_kalem_varyant` FOREIGN KEY (`varyant_id`) REFERENCES `urun_varyantlari` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `pazar_seferleri`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pazar_seferleri` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fis_no` varchar(20) NOT NULL,
  `lokasyon_id` int NOT NULL,
  `cikis_tarihi` date NOT NULL,
  `donus_tarihi` date DEFAULT NULL,
  `durum` enum('yolda','tamamlandi') NOT NULL DEFAULT 'yolda',
  `aciklama` varchar(255) DEFAULT NULL,
  `olusturan_kullanici_id` int DEFAULT NULL,
  `olusturulma_tarihi` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `yolda_anahtar` varchar(10) GENERATED ALWAYS AS ((case when (`durum` = _utf8mb4'yolda') then _utf8mb4'YOLDA' end)) STORED,
  `hasilat` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fis_no_tek` (`fis_no`),
  UNIQUE KEY `yolda_tek` (`yolda_anahtar`),
  KEY `sefer_lokasyon_idx` (`lokasyon_id`),
  KEY `fk_sefer_kullanici` (`olusturan_kullanici_id`),
  CONSTRAINT `fk_sefer_kullanici` FOREIGN KEY (`olusturan_kullanici_id`) REFERENCES `kullanicilar` (`id`),
  CONSTRAINT `fk_sefer_lokasyon` FOREIGN KEY (`lokasyon_id`) REFERENCES `lokasyonlar` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `satinalma_siparis_kalemleri`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `satinalma_siparis_kalemleri` (
  `id` int NOT NULL AUTO_INCREMENT,
  `siparis_id` int NOT NULL,
  `miktar` decimal(10,2) NOT NULL,
  `birim_fiyat` decimal(10,2) NOT NULL,
  `varyant_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `siparis_id` (`siparis_id`),
  KEY `fk_kalem_varyant` (`varyant_id`),
  CONSTRAINT `fk_kalem_varyant` FOREIGN KEY (`varyant_id`) REFERENCES `urun_varyantlari` (`id`),
  CONSTRAINT `satinalma_siparis_kalemleri_ibfk_1` FOREIGN KEY (`siparis_id`) REFERENCES `satinalma_siparisleri` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `satinalma_siparisleri`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `satinalma_siparisleri` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tedarikci_id` int NOT NULL,
  `durum` enum('beklemede','verildi','teslim_alindi','iptal') NOT NULL DEFAULT 'beklemede',
  `siparis_tarihi` datetime DEFAULT CURRENT_TIMESTAMP,
  `teslim_tarihi` datetime DEFAULT NULL,
  `toplam_tutar` decimal(10,2) NOT NULL DEFAULT '0.00',
  `olusturan_kullanici_id` int DEFAULT NULL,
  `iptal_tarihi` datetime DEFAULT NULL,
  `iptal_aciklamasi` varchar(255) DEFAULT NULL,
  `iptal_eden_kullanici_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tedarikci_id` (`tedarikci_id`),
  KEY `fk_siparis_kullanici` (`olusturan_kullanici_id`),
  KEY `idx_satinalma_tarih` (`siparis_tarihi`),
  KEY `fk_satinalma_iptal_eden` (`iptal_eden_kullanici_id`),
  CONSTRAINT `fk_satinalma_iptal_eden` FOREIGN KEY (`iptal_eden_kullanici_id`) REFERENCES `kullanicilar` (`id`),
  CONSTRAINT `fk_siparis_kullanici` FOREIGN KEY (`olusturan_kullanici_id`) REFERENCES `kullanicilar` (`id`),
  CONSTRAINT `satinalma_siparisleri_ibfk_1` FOREIGN KEY (`tedarikci_id`) REFERENCES `tedarikciler` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `satis_siparis_kalemleri`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `satis_siparis_kalemleri` (
  `id` int NOT NULL AUTO_INCREMENT,
  `siparis_id` int NOT NULL,
  `varyant_id` int NOT NULL,
  `miktar` decimal(12,2) NOT NULL,
  `birim_fiyat` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `siparis_id` (`siparis_id`),
  KEY `varyant_id` (`varyant_id`),
  CONSTRAINT `satis_siparis_kalemleri_ibfk_1` FOREIGN KEY (`siparis_id`) REFERENCES `satis_siparisleri` (`id`),
  CONSTRAINT `satis_siparis_kalemleri_ibfk_2` FOREIGN KEY (`varyant_id`) REFERENCES `urun_varyantlari` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `satis_siparisleri`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `satis_siparisleri` (
  `id` int NOT NULL AUTO_INCREMENT,
  `musteri_id` int NOT NULL,
  `durum` enum('beklemede','hazirlaniyor','teslim_edildi','iptal') NOT NULL DEFAULT 'beklemede',
  `siparis_tarihi` datetime DEFAULT CURRENT_TIMESTAMP,
  `teslim_tarihi` datetime DEFAULT NULL,
  `toplam_tutar` decimal(12,2) NOT NULL DEFAULT '0.00',
  `olusturan_kullanici_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `musteri_id` (`musteri_id`),
  KEY `olusturan_kullanici_id` (`olusturan_kullanici_id`),
  KEY `idx_satis_tarih` (`siparis_tarihi`),
  CONSTRAINT `satis_siparisleri_ibfk_1` FOREIGN KEY (`musteri_id`) REFERENCES `musteriler` (`id`),
  CONSTRAINT `satis_siparisleri_ibfk_2` FOREIGN KEY (`olusturan_kullanici_id`) REFERENCES `kullanicilar` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `sayimlar`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sayimlar` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lokasyon_id` int NOT NULL,
  `olusturan_kullanici_id` int DEFAULT NULL,
  `tarih` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `aciklama` varchar(255) DEFAULT NULL,
  `sayilan_kalem` int NOT NULL DEFAULT '0',
  `farkli_kalem` int NOT NULL DEFAULT '0',
  `net_fark` decimal(12,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `idx_sayim_lokasyon` (`lokasyon_id`),
  KEY `idx_sayim_tarih` (`tarih`),
  KEY `fk_sayim_kullanici` (`olusturan_kullanici_id`),
  CONSTRAINT `fk_sayim_kullanici` FOREIGN KEY (`olusturan_kullanici_id`) REFERENCES `kullanicilar` (`id`),
  CONSTRAINT `fk_sayim_lokasyon` FOREIGN KEY (`lokasyon_id`) REFERENCES `lokasyonlar` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `surum` varchar(255) NOT NULL,
  `uygulanma_tarihi` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`surum`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `stok_birimleri`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stok_birimleri` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tip` enum('palet','dokme') NOT NULL DEFAULT 'palet',
  `kod` varchar(30) DEFAULT NULL,
  `varyant_id` int NOT NULL,
  `lokasyon_id` int NOT NULL,
  `miktar` decimal(12,2) NOT NULL DEFAULT '0.00',
  `olusturan_kullanici_id` int DEFAULT NULL,
  `olusturulma_tarihi` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `dokme_anahtar` varchar(50) GENERATED ALWAYS AS ((case when (`tip` = _utf8mb4'dokme') then concat(`varyant_id`,_utf8mb4'-',`lokasyon_id`) end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kod_tek` (`kod`),
  UNIQUE KEY `dokme_tek` (`dokme_anahtar`),
  KEY `idx_varyant` (`varyant_id`),
  KEY `idx_lokasyon` (`lokasyon_id`),
  KEY `fk_birim_kullanici` (`olusturan_kullanici_id`),
  CONSTRAINT `fk_birim_kullanici` FOREIGN KEY (`olusturan_kullanici_id`) REFERENCES `kullanicilar` (`id`),
  CONSTRAINT `fk_birim_lokasyon` FOREIGN KEY (`lokasyon_id`) REFERENCES `lokasyonlar` (`id`),
  CONSTRAINT `fk_birim_varyant` FOREIGN KEY (`varyant_id`) REFERENCES `urun_varyantlari` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `stok_hareketleri`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stok_hareketleri` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tip` enum('giris','cikis','duzeltme') NOT NULL,
  `miktar` decimal(10,2) NOT NULL,
  `aciklama` varchar(255) DEFAULT NULL,
  `tarih` datetime DEFAULT CURRENT_TIMESTAMP,
  `olusturan_kullanici_id` int DEFAULT NULL,
  `varyant_id` int NOT NULL,
  `sebep` enum('satinalma','satis','sayim','fire','iade','manuel') NOT NULL DEFAULT 'manuel',
  `lokasyon_id` int DEFAULT NULL,
  `sayim_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_hareket_kullanici` (`olusturan_kullanici_id`),
  KEY `fk_hareket_lokasyon` (`lokasyon_id`),
  KEY `idx_hareket_tarih` (`tarih`),
  KEY `idx_hareket_varyant_tarih` (`varyant_id`,`tarih`),
  KEY `idx_hareket_sayim` (`sayim_id`),
  CONSTRAINT `fk_hareket_kullanici` FOREIGN KEY (`olusturan_kullanici_id`) REFERENCES `kullanicilar` (`id`),
  CONSTRAINT `fk_hareket_lokasyon` FOREIGN KEY (`lokasyon_id`) REFERENCES `lokasyonlar` (`id`),
  CONSTRAINT `fk_hareket_sayim` FOREIGN KEY (`sayim_id`) REFERENCES `sayimlar` (`id`),
  CONSTRAINT `fk_hareket_varyant` FOREIGN KEY (`varyant_id`) REFERENCES `urun_varyantlari` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `stok_rezervasyonlari`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stok_rezervasyonlari` (
  `id` int NOT NULL AUTO_INCREMENT,
  `siparis_id` int NOT NULL,
  `birim_id` int NOT NULL,
  `miktar` decimal(12,2) NOT NULL,
  `olusturan_kullanici_id` int DEFAULT NULL,
  `olusturulma_tarihi` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `siparis_birim_tek` (`siparis_id`,`birim_id`),
  KEY `idx_rez_birim` (`birim_id`),
  KEY `fk_rez_kullanici` (`olusturan_kullanici_id`),
  CONSTRAINT `fk_rez_birim` FOREIGN KEY (`birim_id`) REFERENCES `stok_birimleri` (`id`),
  CONSTRAINT `fk_rez_kullanici` FOREIGN KEY (`olusturan_kullanici_id`) REFERENCES `kullanicilar` (`id`),
  CONSTRAINT `fk_rez_siparis` FOREIGN KEY (`siparis_id`) REFERENCES `satis_siparisleri` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tedarikciler`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tedarikciler` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ad` varchar(100) NOT NULL,
  `yetkili_kisi` varchar(100) DEFAULT NULL,
  `telefon` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `adres` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `transferler`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transferler` (
  `id` int NOT NULL AUTO_INCREMENT,
  `varyant_id` int NOT NULL,
  `kaynak_lokasyon_id` int NOT NULL,
  `hedef_lokasyon_id` int NOT NULL,
  `miktar` decimal(12,2) NOT NULL,
  `aciklama` varchar(255) DEFAULT NULL,
  `tarih` datetime DEFAULT CURRENT_TIMESTAMP,
  `olusturan_kullanici_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `varyant_id` (`varyant_id`),
  KEY `kaynak_lokasyon_id` (`kaynak_lokasyon_id`),
  KEY `hedef_lokasyon_id` (`hedef_lokasyon_id`),
  KEY `olusturan_kullanici_id` (`olusturan_kullanici_id`),
  CONSTRAINT `transferler_ibfk_1` FOREIGN KEY (`varyant_id`) REFERENCES `urun_varyantlari` (`id`),
  CONSTRAINT `transferler_ibfk_2` FOREIGN KEY (`kaynak_lokasyon_id`) REFERENCES `lokasyonlar` (`id`),
  CONSTRAINT `transferler_ibfk_3` FOREIGN KEY (`hedef_lokasyon_id`) REFERENCES `lokasyonlar` (`id`),
  CONSTRAINT `transferler_ibfk_4` FOREIGN KEY (`olusturan_kullanici_id`) REFERENCES `kullanicilar` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `urun_varyantlari`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `urun_varyantlari` (
  `id` int NOT NULL AUTO_INCREMENT,
  `urun_id` int NOT NULL,
  `boy` varchar(20) NOT NULL,
  `ambalaj_tipi` enum('kova','teneke') NOT NULL DEFAULT 'kova',
  `ambalaj_kg` decimal(6,2) NOT NULL DEFAULT '10.00',
  `barkod` varchar(50) DEFAULT NULL,
  `miktar` decimal(12,2) NOT NULL DEFAULT '0.00',
  `kritik_seviye` decimal(12,2) NOT NULL DEFAULT '0.00',
  `aktif` tinyint(1) NOT NULL DEFAULT '1',
  `olusturulma_tarihi` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `urun_boy_ambalaj` (`urun_id`,`boy`,`ambalaj_tipi`,`ambalaj_kg`),
  UNIQUE KEY `barkod` (`barkod`),
  CONSTRAINT `urun_varyantlari_ibfk_1` FOREIGN KEY (`urun_id`) REFERENCES `urunler` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `urunler`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `urunler` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ad` varchar(100) NOT NULL,
  `olusturulma_tarihi` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `kategori_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_urun_kategori` (`kategori_id`),
  CONSTRAINT `fk_urun_kategori` FOREIGN KEY (`kategori_id`) REFERENCES `kategoriler` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

