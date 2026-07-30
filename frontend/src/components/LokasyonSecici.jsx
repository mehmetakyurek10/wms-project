function LokasyonSecici({
  deger,
  degisti,
  lokasyonlar,
  ad,
  bosMetin = "Seçiniz",
  zorunlu,
}) {
  const alanlar = lokasyonlar.filter((l) => !l.blok);
  const bloklar = [
    ...new Set(lokasyonlar.filter((l) => l.blok).map((l) => l.blok)),
  ].sort();

  const etiket = (l) => {
    const parcalar = [l.kod];
    if (l.ad) parcalar.push(l.ad);
    if (l.miktar !== undefined)
      parcalar.push(`${Number(l.miktar).toFixed(0)} adet`);
    return parcalar.join(" · ");
  };

  return (
    <select name={ad} value={deger} onChange={degisti} required={zorunlu}>
      <option value="">{bosMetin}</option>

      {alanlar.length > 0 && (
        <optgroup label="Alanlar">
          {alanlar.map((l) => (
            <option key={l.lokasyon_id || l.id} value={l.lokasyon_id || l.id}>
              {etiket(l)}
            </option>
          ))}
        </optgroup>
      )}

      {bloklar.map((blok) => (
        <optgroup key={blok} label={`${blok} bloğu`}>
          {lokasyonlar
            .filter((l) => l.blok === blok)
            .map((l) => (
              <option key={l.lokasyon_id || l.id} value={l.lokasyon_id || l.id}>
                {etiket(l)}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

export default LokasyonSecici;
