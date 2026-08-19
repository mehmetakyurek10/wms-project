import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ScanLine, Boxes, Search, X } from "lucide-react";
import { getStockUnits, findPalletByCode } from "../api/stockUnitApi";
import PaletEtiketi from "../components/PaletEtiketi";
import { useToast } from "../context/ToastContext";
import useFetch from "../hooks/useFetch";
import Sayfalama from "../components/Sayfalama";
import { SAYFA_BOYUTU } from "../sabitler";

const sayi = (deger) => Number(deger).toLocaleString("tr-TR");

function Pallets() {
  const bildir = useToast();
  const [parametreler, setParametreler] = useSearchParams();

  const aranan = parametreler.get("ara") || "";
  const sayfa = Number(parametreler.get("sayfa")) || 1;

  const [arama, setArama] = useState(aranan);
  const [scanKod, setScanKod] = useState("");
  const [scanSonuc, setScanSonuc] = useState(null);
  const [etiketPalet, setEtiketPalet] = useState(null);

  const parametreGuncelle = (yeniler) => {
    const sonraki = new URLSearchParams(parametreler);

    for (const [anahtar, deger] of Object.entries(yeniler)) {
      if (deger === "" || deger === undefined || deger === null) {
        sonraki.delete(anahtar);
      } else {
        sonraki.set(anahtar, String(deger));
      }
    }

    setParametreler(sonraki, { replace: true });
  };

  const sorguAnahtari = parametreler.toString();

  const {
    data: pallets,
    total: toplam,
    loading,
    error,
  } = useFetch(
    () =>
      getStockUnits({
        tip: "palet",
        ara: aranan || undefined,
        sayfa,
        limit: SAYFA_BOYUTU,
      }),
    [sorguAnahtari],
    { initial: [], errorMessage: "Paletler yüklenemedi" },
  );

  useEffect(() => {
    const zamanlayici = setTimeout(() => {
      if (arama !== aranan) {
        parametreGuncelle({ ara: arama, sayfa: "" });
      }
    }, 400);
    return () => clearTimeout(zamanlayici);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arama]);

  const scan = async (e) => {
    e.preventDefault();
    const kod = scanKod.trim();
    if (!kod) return;

    try {
      const response = await findPalletByCode(kod);
      setScanSonuc(response.data);
      setScanKod("");
    } catch (err) {
      setScanSonuc(null);
      bildir(err.response?.data?.hata || "Palet bulunamadı", "hata");
    }
  };

  if (loading)
    return (
      <div className="yukleniyor-kutu">
        <div className="spinner" />
        <span>Yükleniyor...</span>
      </div>
    );

  if (error) return <p className="hata-metni">{error}</p>;

  return (
    <div>
      <h2>Palet Sorgula</h2>

      <form onSubmit={scan}>
        <div className="form-alan">
          <label>Palet kodu</label>
          <input
            value={scanKod}
            onChange={(e) => setScanKod(e.target.value)}
            placeholder="Barkodu okut veya kodu yaz"
            autoFocus
          />
        </div>
        <button type="submit">
          <ScanLine size={16} />
          Sorgula
        </button>
      </form>

      {scanSonuc && (
        <div className="kart kart-mavi">
          <div className="kart-ikon">
            <Boxes size={22} />
          </div>
          <div>
            <div className="kart-deger">{scanSonuc.kod}</div>
            <div className="kart-baslik">
              {scanSonuc.urun_adi} · {scanSonuc.boy} · {sayi(scanSonuc.miktar)}{" "}
              adet · {scanSonuc.lokasyon_kod}
            </div>
          </div>
        </div>
      )}

      <h2 className="bolum-basligi">Depodaki Paletler</h2>

      <div className="arama-kutusu">
        <Search size={16} />
        <input
          placeholder="Palet kodu, ürün veya lokasyon ara..."
          value={arama}
          onChange={(e) => setArama(e.target.value)}
        />
      </div>

      {aranan && (
        <div className="filtre-cubugu">
          <button
            className="ikincil ikon-btn"
            onClick={() => setArama("")}
            title="Aramayı temizle"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {pallets.length === 0 ? (
        <div className="bos-durum">Palet bulunamadı.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Ürün</th>
              <th>Varyant</th>
              <th>Lokasyon</th>
              <th>Miktar</th>
              <th>Oluşturan</th>
              <th>Etiket</th>
            </tr>
          </thead>
          <tbody>
            {pallets.map((p) => (
              <tr key={p.id}>
                <td>
                  <span className="etiket etiket-mavi">{p.kod}</span>
                </td>
                <td>{p.urun_adi}</td>
                <td>
                  {p.boy} · {Number(p.ambalaj_kg)}kg {p.ambalaj_tipi}
                </td>
                <td>{p.lokasyon_kod}</td>
                <td>{sayi(p.miktar)}</td>
                <td>{p.olusturan_adi || "—"}</td>
                <td>
                  <button className="ikincil" onClick={() => setEtiketPalet(p)}>
                    Etiket
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Sayfalama
        sayfa={sayfa}
        toplam={toplam}
        sayfaBoyutu={SAYFA_BOYUTU}
        degisti={(yeniSayfa) => parametreGuncelle({ sayfa: yeniSayfa })}
      />

      <PaletEtiketi
        acik={etiketPalet !== null}
        palet={etiketPalet}
        kapat={() => setEtiketPalet(null)}
      />
    </div>
  );
}

export default Pallets;
