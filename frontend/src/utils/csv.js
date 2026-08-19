export function csvIndir(dosyaAdi, basliklar, satirlar) {
  const kacir = (deger) => {
    const metin = String(deger ?? "");
    return /[";\n\r]/.test(metin) ? `"${metin.replace(/"/g, '""')}"` : metin;
  };

  const icerik = [basliklar, ...satirlar]
    .map((satir) => satir.map(kacir).join(";"))
    .join("\r\n");

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
