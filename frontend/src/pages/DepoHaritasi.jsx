import { useEffect, useState } from "react";
import { X, Layers, MoveRight, Package2 } from "lucide-react";
import { lokasyonlariGetir, lokasyonStok } from "../api/lokasyonApi";
import { palletize } from "../api/stockUnitApi";
import { useToast } from "../context/ToastContext";
import Etiket from "../components/Etiket";
import TransferModal from "../components/TransferModal";

function dolulukSinifi(lokasyon) {
  const miktar = Number(lokasyon.toplam_miktar);
  const kapasite = Number(lokasyon.kapasite);

  if (lokasyon.tip === "palet") {
    return miktar > 0 ? "dolu" : "bos";
  }

  if (miktar === 0) return "bos";
  if (kapasite <= 0) return "kapasitesiz";

  const oran = miktar / kapasite;
  if (oran > 1) return "asim";
  if (oran >= 0.85) return "dolu";
  if (oran >= 0.5) return "orta";
  return "az";
}

function DepoHaritasi() {
  const bildir = useToast();
  const [lokasyonlar, setLokasyonlar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [kat, setKat] = useState(1);

  const [secili, setSecili] = useState(null);
  const [seciliStok, setSeciliStok] = useState([]);
  const [stokYukleniyor, setStokYukleniyor] = useState(false);

  const [transferSatiri, setTransferSatiri] = useState(null);

  const [paletlenenId, setPaletlenenId] = useState(null);
  const [paletForm, setPaletForm] = useState({ kod: "", miktar: "" });
  const [paletKaydediliyor, setPaletKaydediliyor] = useState(false);

  const veriGetir = async () => {
    try {
      const response = await lokasyonlariGetir();
      setLokasyonlar(response.data);
      return response.data;
    } catch (err) {
      setHata(err.response?.data?.hata || "Lokasyonlar yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  // Sayfa acilisinda lokasyonlar bir kez cekiliyor. Kural, etki icinde
  // durum atanmasini kaskad cizime yol actigi icin uyariyor; veri cekmede
  // bu kaskad kacinilmaz ve istenen davranistir (once yukleniyor, sonra
  // veri). useFetch'e tasinmadi, cunku veriGetir'in donus degeri paletleme
  // ve transfer akislarinda kullaniliyor; useFetch'in refresh'i veri
  // dondurmuyor.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    veriGetir();
  }, []);

  const stokGetir = async (lokasyonId) => {
    setStokYukleniyor(true);
    try {
      const response = await lokasyonStok(lokasyonId);
      setSeciliStok(response.data);
    } catch (err) {
      setSeciliStok([]);
      bildir(
        err.response?.data?.hata || "Lokasyon içeriği yüklenemedi",
        "hata",
      );
    } finally {
      setStokYukleniyor(false);
    }
  };

  const lokasyonSec = (lokasyon) => {
    if (secili?.id === lokasyon.id) {
      setSecili(null);
      return;
    }
    setSecili(lokasyon);
    setSeciliStok([]);
    setPaletlenenId(null);
    stokGetir(lokasyon.id);
  };

  const transferTamamlandi = async () => {
    setTransferSatiri(null);
    const yeniListe = await veriGetir();
    if (secili && yeniListe) {
      setSecili(yeniListe.find((l) => l.id === secili.id) || null);
      stokGetir(secili.id);
    }
  };

  const paletlemeyeBasla = (satir) => {
    setPaletlenenId(satir.id);
    setPaletForm({ kod: "", miktar: satir.miktar });
  };

  const paletlemeKaydet = async (satir) => {
    const miktar = Number(paletForm.miktar);

    if (!paletForm.kod.trim()) {
      bildir("Palet kodu girilmelidir", "hata");
      return;
    }
    if (!Number.isFinite(miktar) || miktar <= 0) {
      bildir("Miktar sıfırdan büyük olmalıdır", "hata");
      return;
    }

    setPaletKaydediliyor(true);
    try {
      await palletize({
        varyant_id: satir.varyant_id,
        lokasyon_id: secili.id,
        miktar,
        kod: paletForm.kod.trim(),
      });
      bildir("Palet oluşturuldu");
      setPaletlenenId(null);
      const yeniListe = await veriGetir();
      if (yeniListe) {
        setSecili(yeniListe.find((l) => l.id === secili.id) || null);
      }
      stokGetir(secili.id);
    } catch (err) {
      bildir(err.response?.data?.hata || "Palet oluşturulamadı", "hata");
    } finally {
      setPaletKaydediliyor(false);
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

  const tumPaletler = lokasyonlar.filter((l) => l.tip === "palet");
  const paletler = tumPaletler.filter((l) => l.kat === kat);
  const alanlar = lokasyonlar.filter((l) => l.tip !== "palet");
  const katlar = [...new Set(tumPaletler.map((l) => l.kat))].sort();

  const tumGorunur = [...paletler, ...alanlar];
  const maxSatir = Math.max(
    1,
    ...tumGorunur.map((l) => l.satir + (l.satir_span || 1) - 1),
  );
  const maxKolon = Math.max(
    1,
    ...tumGorunur.map((l) => l.kolon + (l.kolon_span || 1) - 1),
  );

  const doluSayisi = paletler.filter((l) => Number(l.toplam_miktar) > 0).length;

  return (
    <div>
      <h2>Depo Haritası</h2>

      <div className="harita-ust">
        <div className="kat-secici">
          <Layers size={15} />
          {katlar.map((k) => (
            <button
              key={k}
              className={kat === k ? "" : "ikincil"}
              onClick={() => {
                setKat(k);
                setSecili(null);
              }}
            >
              {k === 1 ? "Zemin paletler" : `${k}. kat paletler`}
            </button>
          ))}
        </div>
        <span className="kucuk-not">
          {doluSayisi} / {paletler.length} palet yeri dolu
        </span>
      </div>

      <div className="harita-aciklama">
        <span>
          <i className="kutu-ornek palet-bos" /> Boş palet yeri
        </span>
        <span>
          <i className="kutu-ornek palet-dolu" /> Dolu palet yeri
        </span>
        <span>
          <i className="kutu-ornek alan-ornek" /> Depolama alanı
        </span>
        <span>
          <i className="kutu-ornek koridor-ornek" /> Koridor / diğer
        </span>
      </div>

      {tumGorunur.length === 0 ? (
        <div className="bos-durum">Henüz lokasyon tanımlanmamış.</div>
      ) : (
        <div className="depo-cerceve">
          <div
            className="harita"
            style={{
              gridTemplateColumns: `repeat(${maxKolon}, minmax(52px, 1fr))`,
              gridTemplateRows: `repeat(${maxSatir}, minmax(34px, auto))`,
            }}
          >
            {alanlar.map((l) => (
              <button
                key={l.id}
                className={`alan-bolge tip-${l.tip} ${
                  secili?.id === l.id ? "secili" : ""
                }`}
                style={{
                  gridRow: `${l.satir} / span ${l.satir_span || 1}`,
                  gridColumn: `${l.kolon} / span ${l.kolon_span || 1}`,
                }}
                onClick={() => lokasyonSec(l)}
                title={l.ad || l.kod}
              >
                <span className="alan-bolge-ad">{l.ad || l.kod}</span>
                {Number(l.toplam_miktar) > 0 && (
                  <span className="alan-bolge-miktar">
                    {Number(l.toplam_miktar).toFixed(0)} adet · {l.kalem_sayisi}{" "}
                    kalem
                  </span>
                )}
              </button>
            ))}

            {paletler.map((l) => (
              <button
                key={l.id}
                className={`palet-kutu ${dolulukSinifi(l)} ${
                  secili?.id === l.id ? "secili" : ""
                }`}
                style={{
                  gridRow: `${l.satir} / span ${l.satir_span || 1}`,
                  gridColumn: `${l.kolon} / span ${l.kolon_span || 1}`,
                }}
                onClick={() => lokasyonSec(l)}
                title={l.kod}
              >
                <span className="palet-sira">
                  {l.blok}
                  {String(l.sira).padStart(2, "0")}
                </span>
                <span className="palet-derinlik">D{l.derinlik}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {secili && (
        <div className="lokasyon-detay">
          <div className="lokasyon-detay-baslik">
            <div>
              <h3>
                {secili.kod}
                {secili.ad && ` · ${secili.ad}`}
              </h3>
              <div className="lokasyon-detay-bilgi">
                <Etiket deger={secili.tip} />
                <span className="kucuk-not">
                  {secili.tip === "palet"
                    ? `Blok ${secili.blok} · Sıra ${secili.sira} · Derinlik ${secili.derinlik} · Kat ${secili.kat}`
                    : `${secili.satir_span}×${secili.kolon_span} hücre`}
                </span>
              </div>
            </div>
            <button
              className="ikincil ikon-btn"
              onClick={() => setSecili(null)}
              title="Kapat"
            >
              <X size={15} />
            </button>
          </div>

          {stokYukleniyor ? (
            <div className="yukleniyor-kutu">
              <div className="spinner" />
            </div>
          ) : seciliStok.length === 0 ? (
            <div className="bos-durum">Bu lokasyonda stok yok.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Birim</th>
                  <th>Ürün</th>
                  <th>Varyant</th>
                  <th>Miktar (adet)</th>
                  <th>Toplam kg</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {seciliStok.map((s) =>
                  paletlenenId === s.id ? (
                    <tr key={s.id}>
                      <td>
                        <input
                          value={paletForm.kod}
                          onChange={(e) =>
                            setPaletForm({
                              ...paletForm,
                              kod: e.target.value,
                            })
                          }
                          placeholder="Palet kodu"
                          autoFocus
                        />
                      </td>
                      <td>{s.urun_adi}</td>
                      <td>
                        {s.boy} · {Number(s.ambalaj_kg)}kg {s.ambalaj_tipi}
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={paletForm.miktar}
                          onChange={(e) =>
                            setPaletForm({
                              ...paletForm,
                              miktar: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td>—</td>
                      <td>
                        <button
                          onClick={() => paletlemeKaydet(s)}
                          disabled={paletKaydediliyor}
                        >
                          {paletKaydediliyor ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                        <button
                          className="ikincil"
                          onClick={() => setPaletlenenId(null)}
                        >
                          İptal
                        </button>
                      </td>
                    </tr>
                  ) : (
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
                      <td>{Number(s.miktar).toFixed(0)}</td>
                      <td>
                        {(Number(s.miktar) * Number(s.ambalaj_kg)).toFixed(0)}{" "}
                        kg
                      </td>
                      <td>
                        <button onClick={() => setTransferSatiri(s)}>
                          <MoveRight size={14} /> Taşı
                        </button>
                        {s.birim_tipi === "dokme" && (
                          <button
                            className="ikincil"
                            onClick={() => paletlemeyeBasla(s)}
                          >
                            <Package2 size={14} /> Paletle
                          </button>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      <TransferModal
        acik={transferSatiri !== null}
        kaynak={secili}
        stokSatiri={transferSatiri}
        lokasyonlar={lokasyonlar}
        kapat={() => setTransferSatiri(null)}
        tamamlandi={transferTamamlandi}
      />
    </div>
  );
}

export default DepoHaritasi;
