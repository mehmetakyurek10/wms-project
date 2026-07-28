const RENKLER = {
  beklemede: "sari",
  verildi: "mavi",
  teslim_alindi: "yesil",
  iptal: "gri",
  giris: "yesil",
  cikis: "kirmizi",
  duzeltme: "sari",
};

const METINLER = {
  beklemede: "Beklemede",
  verildi: "Sipariş Verildi",
  teslim_alindi: "Teslim Alındı",
  iptal: "İptal",
  giris: "Giriş",
  cikis: "Çıkış",
  duzeltme: "Düzeltme",
};

function Etiket({ deger }) {
  const renk = RENKLER[deger] || "gri";
  const metin = METINLER[deger] || deger;

  return <span className={`etiket etiket-${renk}`}>{metin}</span>;
}

export default Etiket;
