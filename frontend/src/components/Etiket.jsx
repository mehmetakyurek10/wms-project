const RENKLER = {
  beklemede: "sari",
  verildi: "mavi",
  teslim_alindi: "yesil",
  iptal: "gri",
  giris: "yesil",
  cikis: "kirmizi",
  duzeltme: "sari",
  aktif: "yesil",
  pasif: "gri",
  satinalma: "mavi",
  satis: "mavi",
  sayim: "sari",
  fire: "kirmizi",
  iade: "gri",
  manuel: "gri",
  hazirlaniyor: "mavi",
  teslim_edildi: "yesil",
  raf: "mavi",
  alan: "gri",
  soguk_oda: "mavi",
  sevkiyat: "sari",
  kabul: "sari",
};

const METINLER = {
  beklemede: "Beklemede",
  verildi: "Sipariş Verildi",
  teslim_alindi: "Teslim Alındı",
  iptal: "İptal",
  giris: "Giriş",
  cikis: "Çıkış",
  duzeltme: "Düzeltme",
  aktif: "Aktif",
  pasif: "Pasif",
  satinalma: "Satınalma",
  satis: "Satış",
  sayim: "Sayım",
  fire: "Fire",
  iade: "İade",
  manuel: "Manuel",
  hazirlaniyor: "Hazırlanıyor",
  teslim_edildi: "Teslim Edildi",
  raf: "Raf",
  alan: "Alan",
  soguk_oda: "Soğuk Oda",
  sevkiyat: "Sevkiyat",
  kabul: "Mal Kabul",
};

function Etiket({ deger }) {
  const renk = RENKLER[deger] || "gri";
  const metin = METINLER[deger] || deger;

  return <span className={`etiket etiket-${renk}`}>{metin}</span>;
}

export default Etiket;
