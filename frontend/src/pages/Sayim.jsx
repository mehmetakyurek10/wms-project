import { useEffect, useState } from "react";
import { ClipboardCheck, X } from "lucide-react";
import { varyantlariGetir } from "../api/varyantApi";
import { urunleriGetir } from "../api/urunApi";
import { kategorileriGetir } from "../api/kategoriApi";
import { sayimKaydet } from "../api/sayimApi";
import { useToast } from "../context/ToastContext";
import OnayModal from "../components/OnayModal";

const BOS_FILTRE = { kategori_id: "", urun_id: "" };

function Sayim() {
  const bildir = useToast();
  const [varyantlar, setVaryantlar] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [kategoriler, setKategoriler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");

  const [filtre, setFiltre] = useState(BOS_FILTRE);
  const [birim, setBirim] = useState("adet");
  const [sayimlar, setSayimlar] = useState({});
  const [aciklama, setAciklama] = useState("");
  const [onayAcik, setOnayAcik] = useState(false);

  const filtreVar = Object.values(filtre).some((deger) => deger !== "");

  const tanimlariYukle = async () => {
    try {
      const [urunRes, kategoriRes] = await Promise.all([
        urunleriGetir(),
        kategorileriGetir(),
      ]);
      setUrunler(urunRes.data);
      setKategoriler(kategoriRes.data);
    } catch (err) {
      setHata("Tanımlar yüklenemedi");
    }
  };

  const varyantlariYukle = async () => {
    try {
      const response = await varyantlariGetir({ ...filtre, aktif: "1" });
      setVaryantlar(response.data);
    } catch (err) {
      setHata("Stok kalemleri yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    tanimlariYukle();
  }, []);

  useEffect(() => {
    varyantlariYukle();
  }, [filtre]);

  const sayilanAdet = (varyant) => {
    const girilen = sayimlar[varyant.id];
    if (girilen === undefined || girilen === "") return null;
    const sayi = Number(girilen);
    if (Number.isNaN(sayi) || sayi < 0) return null;
    return birim === "kg" ? sayi / (Number(varyant.ambalaj_kg) || 1) : sayi;
  };

  const girilenKalemler = varyantlar
    .map((varyant) => ({ varyant, sayilan: sayilanAdet(varyant) }))
    .filter((kalem) => kalem.sayilan !== null);

  const farkliKalemler = girilenKalemler.filter(
    (kalem) => kalem.sayilan !== Number(kalem.varyant.miktar),
  );

  const sayimDegisti = (varyantId, deger) => {
    setSayimlar({ ...sayimlar, [varyantId]: deger });
  };

  const filtreDegisti = (e) => {
    setFiltre({ ...filtre, [e.target.name]: e.target.value });
  };

  const kaydet = async () => {
    setOnayAcik(false);
    try {
      const response = await sayimKaydet({
        aciklama,
        kalemler: girilenKalemler.map((kalem) => ({
          varyant_id: kalem.varyant.id,
          sayilan_miktar: kalem.sayilan,
        })),
      });
      bildir(response.data.mesaj);
      setSayimlar({});
      setAciklama("");
      varyantlariYukle();
    } catch (err) {
      bildir(err.response?.data?.hata || "Sayım kaydedilemedi", "hata");
    }
  };

  if (yukleniyor)
    return (
      <div className="yukleniyor-kutu">
        <div className="spinner" />
        <span>Yükleniyor...</span>
      </div>
    );
  if (hata) return <p className="hata-metni">{hata}</p>;

  return (
    <div>
      <h2>Stok Sayımı</h2>

      <div className="filtre-cubugu">
        <div className="form-alan">
          <label>Kategori</label>
          <select
            name="kategori_id"
            value={filtre.kategori_id}
            onChange={filtreDegisti}
          >
            <option value="">Tümü</option>
            {kategoriler.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alan">
          <label>Ürün</label>
          <select
            name="urun_id"
            value={filtre.urun_id}
            onChange={filtreDegisti}
          >
            <option value="">Tümü</option>
            {urunler.map((u) => (
              <option key={u.id} value={u.id}>
                {u.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alan">
          <label>Sayım birimi</label>
          <select value={birim} onChange={(e) => setBirim(e.target.value)}>
            <option value="adet">adet</option>
            <option value="kg">kg</option>
          </select>
        </div>

        <div className="form-alan">
          <label>Açıklama</label>
          <input
            placeholder="Örn. Temmuz ayı sayımı"
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
          />
        </div>

        {filtreVar && (
          <button
            className="ikincil ikon-btn"
            onClick={() => setFiltre(BOS_FILTRE)}
            title="Filtreleri temizle"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {varyantlar.length === 0 ? (
        <div className="bos-durum">Sayılacak stok kalemi bulunamadı.</div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Varyant</th>
                <th>Sistemde (adet)</th>
                <th>Sayılan ({birim})</th>
                <th>Fark (adet)</th>
              </tr>
            </thead>
            <tbody>
              {varyantlar.map((v) => {
                const sayilan = sayilanAdet(v);
                const mevcut = Number(v.miktar);
                const fark = sayilan === null ? null : sayilan - mevcut;

                return (
                  <tr key={v.id}>
                    <td>{v.urun_adi}</td>
                    <td>
                      {v.boy} · {Number(v.ambalaj_kg)}kg {v.ambalaj_tipi}
                    </td>
                    <td>{mevcut.toFixed(0)}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="-"
                        value={sayimlar[v.id] ?? ""}
                        onChange={(e) => sayimDegisti(v.id, e.target.value)}
                      />
                    </td>
                    <td>
                      {fark === null ? (
                        <span className="kucuk-not">-</span>
                      ) : fark === 0 ? (
                        <span className="kucuk-not">Uyumlu</span>
                      ) : (
                        <strong
                          className={fark > 0 ? "fark-arti" : "fark-eksi"}
                        >
                          {fark > 0 ? "+" : ""}
                          {fark.toFixed(2)}
                        </strong>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="sayim-alt">
            <span className="kucuk-not">
              {girilenKalemler.length} kalem sayıldı · {farkliKalemler.length}{" "}
              kalemde fark var
            </span>
            <button
              onClick={() => setOnayAcik(true)}
              disabled={girilenKalemler.length === 0}
            >
              <ClipboardCheck size={15} /> Sayımı Kaydet
            </button>
          </div>
        </>
      )}

      <OnayModal
        acik={onayAcik}
        baslik="Sayımı kaydet"
        mesaj={
          farkliKalemler.length === 0
            ? `${girilenKalemler.length} kalem sayıldı, hiçbirinde fark yok. Kayıt oluşturulmayacak.`
            : `${farkliKalemler.length} kalemde fark tespit edildi. Onaylarsan stoklar sayılan değerlere güncellenecek ve her fark için sayım hareketi kaydedilecek.`
        }
        onayMetni="Kaydet"
        onayla={kaydet}
        iptal={() => setOnayAcik(false)}
      />
    </div>
  );
}

export default Sayim;
