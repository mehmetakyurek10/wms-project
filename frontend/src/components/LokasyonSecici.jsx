import { useState } from "react";

function LokasyonSecici({
  deger,
  degisti,
  lokasyonlar,
  ad,
  bosMetin = "Seçiniz",
  zorunlu,
}) {
  const [kat, setKat] = useState("");

  const paletler = lokasyonlar.filter((l) => l.blok);
  const alanlar = lokasyonlar.filter((l) => !l.blok);

  const katlar = [...new Set(paletler.map((l) => l.kat))].sort((a, b) => a - b);

  const gorunenPaletler = kat
    ? paletler.filter((l) => String(l.kat) === kat)
    : paletler;

  const bloklar = [...new Set(gorunenPaletler.map((l) => l.blok))].sort();

  const katDegisti = (e) => {
    const yeniKat = e.target.value;
    setKat(yeniKat);

    if (!deger) return;

    const yeniGorunenler = yeniKat
      ? paletler.filter((l) => String(l.kat) === yeniKat)
      : paletler;

    const halaGorunur = [...alanlar, ...yeniGorunenler].some(
      (l) => String(l.lokasyon_id || l.id) === String(deger),
    );

    if (!halaGorunur) {
      degisti({ target: { name: ad, value: "" } });
    }
  };

  const etiket = (l) => {
    const parcalar = [l.kod];
    if (l.ad) parcalar.push(l.ad);
    if (l.miktar !== undefined) {
      parcalar.push(`${Number(l.miktar).toFixed(0)} adet`);
    } else if (Number(l.dolu) > 0 || Number(l.toplam_miktar) > 0) {
      parcalar.push("dolu");
    }
    return parcalar.join(" · ");
  };

  return (
    <div className="lokasyon-secici">
      {katlar.length > 1 && (
        <select className="kat-filtresi" value={kat} onChange={katDegisti}>
          <option value="">Tüm katlar</option>
          {katlar.map((k) => (
            <option key={k} value={k}>
              {k}. kat
            </option>
          ))}
        </select>
      )}

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
            {gorunenPaletler
              .filter((l) => l.blok === blok)
              .map((l) => (
                <option
                  key={l.lokasyon_id || l.id}
                  value={l.lokasyon_id || l.id}
                >
                  {etiket(l)}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export default LokasyonSecici;
