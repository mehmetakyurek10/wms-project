import { useEffect, useState } from "react";
import { ClipboardCheck, Plus } from "lucide-react";
import { lokasyonlariGetir, lokasyonStok } from "../api/lokasyonApi";
import { varyantlariGetir } from "../api/varyantApi";
import { sayimKaydet } from "../api/sayimApi";
import LokasyonSecici from "../components/LokasyonSecici";
import OnayModal from "../components/OnayModal";
import { useToast } from "../context/ToastContext";

function Sayim() {
  const bildir = useToast();
  const [lokasyonlar, setLokasyonlar] = useState([]);
  const [varyantlar, setVaryantlar] = useState([]);
  const [lokasyonId, setLokasyonId] = useState("");
  const [satirlar, setSatirlar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [stokYukleniyor, setStokYukleniyor] = useState(false);
  const [hata, setHata] = useState("");

  const [birim, setBirim] = useState("adet");
  const [sayimlar, setSayimlar] = useState({});
  const [aciklama, setAciklama] = useState("");
  const [eklenecekVaryant, setEklenecekVaryant] = useState("");
  const [onayAcik, setOnayAcik] = useState(false);

  const tanimlariYukle = async () => {
    try {
      const [lokasyonRes, varyantRes] = await Promise.all([
        lokasyonlariGetir(),
        varyantlariGetir(),
      ]);
      setLokasyonlar(lokasyonRes.data.filter((l) => l.aktif));
      setVaryantlar(varyantRes.data);
    } catch (err) {
      setHata(err.response?.data?.hata || "Tanımlar yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    tanimlariYukle();
  }, []);

  const lokasyonSecildi = async (e) => {
    const id = e.target.value;
    setLokasyonId(id);
    setSayimlar({});
    setSatirlar([]);

    if (!id) return;

    setStokYukleniyor(true);
    try {
      const response = await lokasyonStok(id);
      setSatirlar(response.data);
    } catch (err) {
      bildir(err.response?.data?.hata || "Lokasyon içeriği yüklenemedi", "hata");
    } finally {
      setStokYukleniyor(false);
    }
  };

  const varyantEkle = () => {
    if (!eklenecekVaryant) return;

    const varyantId = parseInt(eklenecekVaryant, 10);

    if (
      satirlar.some(
        (s) => s.varyant_id === varyantId && s.birim_tipi !== "palet",
      )
    ) {
      bildir("Bu ürünün dökme satırı zaten listede", "hata");
      return;
    }

    const varyant = varyantlar.find((v) => v.id === varyantId);

    setSatirlar([
      ...satirlar,
      {
        id: `yeni-${varyantId}`,
        varyant_id: varyantId,
        birim_tipi: "dokme",
        birim_kodu: null,
        urun_adi: varyant.urun_adi,
        boy: varyant.boy,
        ambalaj_tipi: varyant.ambalaj_tipi,
        ambalaj_kg: varyant.ambalaj_kg,
        miktar: 0,
      },
    ]);
    setEklenecekVaryant("");
  };

  const sayilanAdet = (satir) => {
    const girilen = sayimlar[satir.id];
    if (girilen === undefined || girilen === "") return null;
    const sayi = Number(girilen);
    if (Number.isNaN(sayi) || sayi < 0) return null;
    return birim === "kg" ? sayi / (Number(satir.ambalaj_kg) || 1) : sayi;
  };

  const girilenKalemler = satirlar
    .map((satir) => ({ satir, sayilan: sayilanAdet(satir) }))
    .filter((kalem) => kalem.sayilan !== null);

  const farkliKalemler = girilenKalemler.filter(
    (kalem) => kalem.sayilan !== Number(kalem.satir.miktar),
  );

  const kaydet = async () => {
    setOnayAcik(false);
    try {
      const response = await sayimKaydet({
        lokasyon_id: lokasyonId,
        aciklama,
        kalemler: girilenKalemler.map((kalem) =>
          typeof kalem.satir.id === "number"
            ? { birim_id: kalem.satir.id, sayilan_miktar: kalem.sayilan }
            : {
                varyant_id: kalem.satir.varyant_id,
                sayilan_miktar: kalem.sayilan,
              },
        ),
      });
      bildir(response.data.mesaj);
      setSayimlar({});
      setAciklama("");
      lokasyonSecildi({ target: { value: lokasyonId } });
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

  const secilenLokasyon = lokasyonlar.find(
    (l) => l.id === parseInt(lokasyonId, 10),
  );

  return (
    <div>
      <h2>Stok Sayımı</h2>

      <div className="filtre-cubugu">
        <div className="form-alan">
          <label>Sayılacak lokasyon</label>
          <LokasyonSecici
            deger={lokasyonId}
            degisti={lokasyonSecildi}
            lokasyonlar={lokasyonlar}
          />
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
      </div>

      {!lokasyonId ? (
        <div className="bos-durum">
          Sayıma başlamak için bir lokasyon seçin.
        </div>
      ) : stokYukleniyor ? (
        <div className="yukleniyor-kutu">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="filtre-cubugu">
            <div className="form-alan">
              <label>Listede olmayan ürün ekle (dökme)</label>
              <select
                value={eklenecekVaryant}
                onChange={(e) => setEklenecekVaryant(e.target.value)}
              >
                <option value="">Seçiniz</option>
                {varyantlar.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.urun_adi} · {v.boy} · {Number(v.ambalaj_kg)}kg{" "}
                    {v.ambalaj_tipi}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="ikincil"
              onClick={varyantEkle}
              disabled={!eklenecekVaryant}
            >
              <Plus size={15} /> Ekle
            </button>
          </div>

          {satirlar.length === 0 ? (
            <div className="bos-durum">
              Bu lokasyonda kayıtlı stok yok. Beklenmedik ürün bulduysan
              yukarıdan ekleyebilirsin.
            </div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Birim</th>
                    <th>Ürün</th>
                    <th>Varyant</th>
                    <th>Sistemde (adet)</th>
                    <th>Sayılan ({birim})</th>
                    <th>Fark (adet)</th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map((s) => {
                    const sayilan = sayilanAdet(s);
                    const mevcut = Number(s.miktar);
                    const fark = sayilan === null ? null : sayilan - mevcut;

                    return (
                      <tr key={s.id}>
                        <td>
                          {s.birim_tipi === "palet" ? (
                            <span className="etiket etiket-mavi">
                              {s.birim_kodu}
                            </span>
                          ) : (
                            <span className="etiket etiket-gri">Dökme</span>
                          )}
                        </td>
                        <td>{s.urun_adi}</td>
                        <td>
                          {s.boy} · {Number(s.ambalaj_kg)}kg {s.ambalaj_tipi}
                        </td>
                        <td>{mevcut.toFixed(0)}</td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="-"
                            value={sayimlar[s.id] ?? ""}
                            onChange={(e) =>
                              setSayimlar({
                                ...sayimlar,
                                [s.id]: e.target.value,
                              })
                            }
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
                  {girilenKalemler.length} birim sayıldı ·{" "}
                  {farkliKalemler.length} birimde fark var
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
        </>
      )}

      <OnayModal
        acik={onayAcik}
        baslik="Sayımı kaydet"
        mesaj={
          farkliKalemler.length === 0
            ? `${girilenKalemler.length} birim sayıldı, hiçbirinde fark yok. Kayıt oluşturulmayacak.`
            : `${secilenLokasyon?.kod} lokasyonunda ${farkliKalemler.length} birimde fark tespit edildi. Onaylarsan bu birimlerin miktarları sayılan değerlere güncellenecek.`
        }
        onayMetni="Kaydet"
        onayla={kaydet}
        iptal={() => setOnayAcik(false)}
      />
    </div>
  );
}

export default Sayim;
