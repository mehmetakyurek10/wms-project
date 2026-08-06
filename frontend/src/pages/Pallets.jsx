import { useEffect, useState } from "react";
import { ScanLine, Boxes, Search, X } from "lucide-react";
import { getStockUnits, findPalletByCode } from "../api/stockUnitApi";
import { useToast } from "../context/ToastContext";
import useFetch from "../hooks/useFetch";

const sayi = (deger) => Number(deger).toLocaleString("tr-TR");

function Pallets() {
  const bildir = useToast();

  const [arama, setArama] = useState("");
  const [aranan, setAranan] = useState("");
  const [scanKod, setScanKod] = useState("");
  const [scanSonuc, setScanSonuc] = useState(null);

  const {
    data: pallets,
    loading,
    error,
  } = useFetch(
    () => getStockUnits({ tip: "palet", ara: aranan || undefined }),
    [aranan],
    { initial: [], errorMessage: "Paletler yüklenemedi" },
  );

  useEffect(() => {
    const zamanlayici = setTimeout(() => setAranan(arama), 400);
    return () => clearTimeout(zamanlayici);
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Pallets;
