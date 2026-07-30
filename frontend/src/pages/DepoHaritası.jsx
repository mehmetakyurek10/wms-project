import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Layers } from "lucide-react";
import {
  lokasyonlariGetir,
  lokasyonStok,
  lokasyonEkle,
  lokasyonGuncelle,
  lokasyonSil,
} from "../api/lokasyonApi";
import Etiket from "../components/Etiket";
import OnayModal from "../components/OnayModal";
import { useToast } from "../context/ToastContext";

const BOS_FORM = {
  kod: "",
  ad: "",
  tip: "alan",
  satir: 1,
  kolon: 1,
  satir_span: 1,
  kolon_span: 1,
  kapasite: 0,
};

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

  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState(BOS_FORM);
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [silinecek, setSilinecek] = useState(null);

  const veriGetir = async () => {
    try {
      const response = await lokasyonlariGetir();
      setLokasyonlar(response.data);
    } catch (err) {
      setHata("Lokasyonlar yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    veriGetir();
  }, []);

  const lokasyonSec = async (lokasyon) => {
    if (secili?.id === lokasyon.id) {
      setSecili(null);
      return;
    }
    setSecili(lokasyon);
    setSeciliStok([]);
    setStokYukleniyor(true);
    try {
      const response = await lokasyonStok(lokasyon.id);
      setSeciliStok(response.data);
    } catch (err) {
      bildir("Lokasyon içeriği yüklenemedi", "hata");
    } finally {
      setStokYukleniyor(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const formuAc = (lokasyon) => {
    if (lokasyon) {
      setDuzenlenenId(lokasyon.id);
      setForm({
        kod: lokasyon.kod,
        ad: lokasyon.ad || "",
        tip: lokasyon.tip,
        satir: lokasyon.satir,
        kolon: lokasyon.kolon,
        satir_span: lokasyon.satir_span,
        kolon_span: lokasyon.kolon_span,
        kapasite: lokasyon.kapasite,
      });
    } else {
      setDuzenlenenId(null);
      setForm(BOS_FORM);
    }
    setFormAcik(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (duzenlenenId) {
        await lokasyonGuncelle(duzenlenenId, form);
        bildir("Lokasyon güncellendi");
      } else {
        await lokasyonEkle(form);
        bildir("Lokasyon eklendi");
      }
      setFormAcik(false);
      setForm(BOS_FORM);
      setDuzenlenenId(null);
      setSecili(null);
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Kaydedilemedi", "hata");
    }
  };

  const silOnayla = async () => {
    const id = silinecek.id;
    setSilinecek(null);
    try {
      await lokasyonSil(id);
      bildir("Lokasyon silindi");
      setSecili(null);
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Silinemedi", "hata");
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
      <div className="sayfa-basligi">
        <h2>Depo Haritası</h2>
        <button className="ikincil" onClick={() => formuAc(null)}>
          <Plus size={15} /> Alan Ekle
        </button>
      </div>

      {formAcik && (
        <form onSubmit={handleSubmit}>
          <div className="form-alan">
            <label>Kod</label>
            <input
              name="kod"
              placeholder="SEVK-01"
              value={form.kod}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-alan">
            <label>Ad</label>
            <input
              name="ad"
              placeholder="İsteğe bağlı"
              value={form.ad}
              onChange={handleChange}
            />
          </div>
          <div className="form-alan">
            <label>Tip</label>
            <select name="tip" value={form.tip} onChange={handleChange}>
              <option value="alan">Alan</option>
              <option value="raf">Raf</option>
              <option value="soguk_oda">Soğuk Oda</option>
              <option value="sevkiyat">Sevkiyat</option>
              <option value="koridor">Koridor</option>
              <option value="ofis">Ofis</option>
            </select>
          </div>
          <div className="form-alan">
            <label>Satır</label>
            <input
              name="satir"
              type="number"
              min="1"
              value={form.satir}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-alan">
            <label>Kolon</label>
            <input
              name="kolon"
              type="number"
              min="1"
              value={form.kolon}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-alan">
            <label>Satır yayılma</label>
            <input
              name="satir_span"
              type="number"
              min="1"
              value={form.satir_span}
              onChange={handleChange}
            />
          </div>
          <div className="form-alan">
            <label>Kolon yayılma</label>
            <input
              name="kolon_span"
              type="number"
              min="1"
              value={form.kolon_span}
              onChange={handleChange}
            />
          </div>
          <div className="form-alan">
            <label>Kapasite (adet)</label>
            <input
              name="kapasite"
              type="number"
              step="0.01"
              value={form.kapasite}
              onChange={handleChange}
            />
          </div>
          <button type="submit">{duzenlenenId ? "Güncelle" : "Ekle"}</button>
          <button
            type="button"
            className="ikincil"
            onClick={() => {
              setFormAcik(false);
              setDuzenlenenId(null);
            }}
          >
            Vazgeç
          </button>
        </form>
      )}

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
                    : `Satır ${secili.satir} · Kolon ${secili.kolon} · ${secili.satir_span}×${secili.kolon_span} hücre`}
                </span>
              </div>
            </div>
            <div className="lokasyon-detay-aksiyon">
              <button
                className="ikincil ikon-btn"
                onClick={() => formuAc(secili)}
                title="Düzenle"
              >
                <Pencil size={15} />
              </button>
              <button
                className="tehlike ikon-btn"
                onClick={() => setSilinecek(secili)}
                title="Sil"
              >
                <Trash2 size={15} />
              </button>
              <button
                className="ikincil ikon-btn"
                onClick={() => setSecili(null)}
                title="Kapat"
              >
                <X size={15} />
              </button>
            </div>
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
                  <th>Ürün</th>
                  <th>Varyant</th>
                  <th>Miktar (adet)</th>
                  <th>Toplam kg</th>
                  <th>Barkod</th>
                </tr>
              </thead>
              <tbody>
                {seciliStok.map((s) => (
                  <tr key={s.id}>
                    <td>{s.urun_adi}</td>
                    <td>
                      {s.boy} · {Number(s.ambalaj_kg)}kg {s.ambalaj_tipi}
                    </td>
                    <td>{Number(s.miktar).toFixed(0)}</td>
                    <td>
                      {(Number(s.miktar) * Number(s.ambalaj_kg)).toFixed(0)} kg
                    </td>
                    <td>{s.barkod || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <OnayModal
        acik={silinecek !== null}
        baslik="Lokasyonu sil"
        mesaj={`${silinecek?.kod} lokasyonu silinecek.`}
        onayla={silOnayla}
        iptal={() => setSilinecek(null)}
      />
    </div>
  );
}

export default DepoHaritasi;
