import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { getSystemChecks } from "../api/healthApi";
import useFetch from "../hooks/useFetch";
import ErrorState from "../components/ErrorState";

const LEVEL = {
  kritik: { sinif: "etiket etiket-kirmizi", metin: "Kritik" },
  uyari: { sinif: "etiket etiket-sari", metin: "Uyarı" },
};

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && /^-?\d+\.\d+$/.test(value)) {
    return Number(value).toLocaleString("tr-TR");
  }
  return value;
}

function SystemHealth() {
  const { data, loading, fetching, error, refresh } = useFetch(
    () => getSystemChecks(),
    [],
    { initial: null, errorMessage: "Kontroller yüklenemedi" },
  );

  if (error) return <ErrorState mesaj={error} tekrarDene={refresh} />;

  if (loading || !data) {
    return (
      <div className="yukleniyor-kutu">
        <div className="spinner" />
        <span>Kontroller çalıştırılıyor...</span>
      </div>
    );
  }

  const temiz = data.toplamSorun === 0;

  return (
    <div>
      <h2>Sistem Sağlığı</h2>

      <div className="form-alan" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className="ikincil"
          onClick={refresh}
          disabled={fetching}
        >
          <RefreshCw size={15} />
          {fetching ? "Çalıştırılıyor..." : "Yeniden Çalıştır"}
        </button>
      </div>

      <div className={`kart ${temiz ? "kart-yesil" : "kart-turuncu"}`}>
        <div className="kart-ikon">
          {temiz ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
        </div>
        <div>
          <div className="kart-deger">{data.toplamSorun}</div>
          <div className="kart-baslik">
            {temiz ? "Sorun bulunamadı" : `Bulgu · ${data.kritikSorun} kritik`}
          </div>
        </div>
      </div>

      <p className="bos-durum" style={{ textAlign: "left" }}>
        Son çalıştırma: {new Date(data.olusturulma).toLocaleString("tr-TR")}
      </p>

      {data.kontroller.map((kontrol) => {
        const seviye = LEVEL[kontrol.seviye] || LEVEL.uyari;
        const sorunVar = kontrol.satirlar.length > 0;

        return (
          <div key={kontrol.anahtar}>
            <h2 className="bolum-basligi">
              {kontrol.ad} <span className={seviye.sinif}>{seviye.metin}</span>
            </h2>

            <p className="bos-durum" style={{ textAlign: "left" }}>
              {kontrol.aciklama}
            </p>

            {!sorunVar ? (
              <div className="bos-durum">Sorun bulunamadı.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    {kontrol.kolonlar.map((k) => (
                      <th key={k.key}>{k.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kontrol.satirlar.map((satir, i) => (
                    <tr key={i}>
                      {kontrol.kolonlar.map((k) => (
                        <td key={k.key}>{formatValue(satir[k.key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SystemHealth;
