export function csvOlustur(basliklar, satirlar) {
  const kacir = (deger) => {
    const metin = String(deger ?? "");
    return /[";\n\r]/.test(metin) ? `"${metin.replace(/"/g, '""')}"` : metin;
  };

  return [basliklar, ...satirlar]
    .map((satir) => satir.map(kacir).join(";"))
    .join("\r\n");
}

export function csvIndir(dosyaAdi, basliklar, satirlar) {
  const icerik = csvOlustur(basliklar, satirlar);

  const blob = new Blob(["\uFEFF" + icerik], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const baglanti = document.createElement("a");

  baglanti.href = url;
  baglanti.download = dosyaAdi;
  baglanti.click();

  URL.revokeObjectURL(url);
}
