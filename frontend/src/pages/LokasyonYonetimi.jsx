import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  ShieldCheck,
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  Grid3x3,
} from "lucide-react";
import {
  lokasyonlariGetir,
  lokasyonEkle,
  lokasyonGuncelle,
  lokasyonSil,
  blokOlustur,
  tutarlilikKontrol,
} from "../api/lokasyonApi";
import Etiket from "../components/Etiket";
import OnayModal from "../components/OnayModal";
import Sayfalama from "../components/Sayfalama";
import { useToast } from "../context/ToastContext";
import useAuth from "../hooks/useAuth";
import { SAYFA_BOYUTU } from "../sabitler";

const BOS_ALAN = {
  kod: "",
  ad: "",
  tip: "alan",
  satir: 1,
  kolon: 1,
  satir_span: 1,
  kolon_span: 1,
  kapasite: 0,
};

const BOS_BLOK = {
  blok: "",
  sira_baslangic: 1,
  sira_sayisi: 1,
  derinlik: 1,
  kat: 1,
  baslangic_satir: 1,
  baslangic_kolon: 1,
  derinlik_genislik: 1,
  ters: false,
  derinlik_ters: false,
};

function LokasyonYonetimi() {
  const bildir = useToast();
  const { kullanici } = useAuth();

  const [lokasyonlar, setLokasyonlar] = useState([]);
  const [sapmalar, setSapmalar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");

  const [tipFiltre, setTipFiltre] = useState("");
  const [blokFiltre, setBlokFiltre] = useState("");
  const [sayfa, setSayfa] = useState(1);

  const [alanForm, setAlanForm] = useState(BOS_ALAN);
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [blokForm, setBlokForm] = useState(BOS_BLOK);
  const [silinecek, setSilinecek] = useState(null);
  const [alanGonderiliyor, setAlanGonderiliyor] = useState(false);
  const [blokGonderiliyor, setBlokGonderiliyor] = useState(false);

  const veriGetir = async () => {
    try {
      const [lokasyonRes, tutarlilikRes] = await Promise.all([
        lokasyonlariGetir(),
        tutarlilikKontrol(),
      ]);
      setLokasyonlar(lokasyonRes.data);
      setSapmalar(tutarlilikRes.data);
    } catch (err) {
      setHata(err.response?.data?.hata || "Veriler yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  // Sayfa acilisinda lokasyonlar ve tutarlilik raporu birlikte cekiliyor.
  // Kural, etki icinde durum atanmasina uyariyor; veri cekmede bu kaskad
  // kacinilmaz. veriGetir ayrica her kayit, guncelleme ve silme sonrasi
  // yeniden cagriliyor.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    veriGetir();
  }, []);

  if (kullanici?.rol !== "admin") {
    return <Navigate to="/panel" />;
  }

  const alanDegisti = (e) => {
    setAlanForm({ ...alanForm, [e.target.name]: e.target.value });
  };

  const blokDegisti = (e) => {
    const { name, type, checked, value } = e.target;
    setBlokForm({ ...blokForm, [name]: type === "checkbox" ? checked : value });
  };

  const alanKaydet = async (e) => {
    e.preventDefault();
    if (alanGonderiliyor) return;
    setAlanGonderiliyor(true);
    try {
      if (duzenlenenId) {
        await lokasyonGuncelle(duzenlenenId, alanForm);
        bildir("Lokasyon güncellendi");
      } else {
        await lokasyonEkle(alanForm);
        bildir("Lokasyon eklendi");
      }
      setAlanForm(BOS_ALAN);
      setDuzenlenenId(null);
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Kaydedilemedi", "hata");
    } finally {
      setAlanGonderiliyor(false);
    }
  };

  const duzenlemeyeBasla = (l) => {
    setDuzenlenenId(l.id);
    setAlanForm({
      kod: l.kod,
      ad: l.ad || "",
      tip: l.tip,
      satir: l.satir,
      kolon: l.kolon,
      satir_span: l.satir_span,
      kolon_span: l.kolon_span,
      kapasite: l.kapasite,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const blokKaydet = async (e) => {
    e.preventDefault();
    if (blokGonderiliyor) return;
    setBlokGonderiliyor(true);
    try {
      const response = await blokOlustur({ ...blokForm, yon: "dikey" });
      bildir(response.data.mesaj);
      setBlokForm(BOS_BLOK);
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Blok oluşturulamadı", "hata");
    } finally {
      setBlokGonderiliyor(false);
    }
  };

  const silOnayla = async () => {
    const id = silinecek.id;
    setSilinecek(null);
    try {
      await lokasyonSil(id);
      bildir("Lokasyon silindi");
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

  const bloklar = [
    ...new Set(lokasyonlar.filter((l) => l.blok).map((l) => l.blok)),
  ].sort();

  const gorunenler = lokasyonlar.filter((l) => {
    if (tipFiltre && l.tip !== tipFiltre) return false;
    if (blokFiltre && l.blok !== blokFiltre) return false;
    return true;
  });

  const toplamSayfa = Math.max(1, Math.ceil(gorunenler.length / SAYFA_BOYUTU));
  const gecerliSayfa = Math.min(sayfa, toplamSayfa);
  const sayfadakiler = gorunenler.slice(
    (gecerliSayfa - 1) * SAYFA_BOYUTU,
    gecerliSayfa * SAYFA_BOYUTU,
  );

  return (
    <div>
      <h2>Lokasyon Yönetimi</h2>

      <div className={`tutarlilik-kutu ${sapmalar.length ? "sapma-var" : ""}`}>
        {sapmalar.length === 0 ? (
          <>
            <ShieldCheck size={20} />
            <div>
              <strong>Stok kayıtları tutarlı</strong>
              <span className="kucuk-not">
                Tüm varyantlarda toplam stok ile lokasyon dağılımı eşleşiyor.
              </span>
            </div>
          </>
        ) : (
          <>
            <ShieldAlert size={20} />
            <div>
              <strong>{sapmalar.length} varyantta tutarsızlık var</strong>
              <span className="kucuk-not">
                Toplam stok ile lokasyon dağılımı uyuşmuyor. Sayım yaparak
                düzeltebilirsiniz.
              </span>
            </div>
          </>
        )}
      </div>

      {sapmalar.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Varyant</th>
              <th>Toplam</th>
              <th>Lokasyonlarda</th>
              <th>Fark</th>
            </tr>
          </thead>
          <tbody>
            {sapmalar.map((s) => (
              <tr key={s.varyant_id}>
                <td>{s.urun_adi}</td>
                <td>
                  {s.boy} · {s.ambalaj_tipi}
                </td>
                <td>{Number(s.toplam).toFixed(0)}</td>
                <td>{Number(s.lokasyon_toplami).toFixed(0)}</td>
                <td>
                  <strong
                    className={Number(s.fark) > 0 ? "fark-arti" : "fark-eksi"}
                  >
                    {Number(s.fark) > 0 ? "+" : ""}
                    {Number(s.fark).toFixed(0)}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="bolum-basligi">
        {duzenlenenId ? "Lokasyonu Düzenle" : "Alan Ekle"}
      </h2>

      <form onSubmit={alanKaydet}>
        <div className="form-alan">
          <label>Kod</label>
          <input
            name="kod"
            placeholder="SEVK-01"
            value={alanForm.kod}
            onChange={alanDegisti}
            required
          />
        </div>
        <div className="form-alan">
          <label>Ad</label>
          <input
            name="ad"
            placeholder="İsteğe bağlı"
            value={alanForm.ad}
            onChange={alanDegisti}
          />
        </div>
        <div className="form-alan">
          <label>Tip</label>
          <select name="tip" value={alanForm.tip} onChange={alanDegisti}>
            <option value="alan">Alan</option>
            <option value="kabul">Mal Kabul</option>
            <option value="sevkiyat">Sevkiyat</option>
            <option value="raf">Raf</option>
            <option value="soguk_oda">Soğuk Oda</option>
            <option value="koridor">Koridor</option>
            <option value="ofis">Ofis</option>
            <option value="pazar">Pazar</option>
          </select>
        </div>
        <div className="form-alan">
          <label>Satır</label>
          <input
            name="satir"
            type="number"
            min="1"
            value={alanForm.satir}
            onChange={alanDegisti}
            required
          />
        </div>
        <div className="form-alan">
          <label>Kolon</label>
          <input
            name="kolon"
            type="number"
            min="1"
            value={alanForm.kolon}
            onChange={alanDegisti}
            required
          />
        </div>
        <div className="form-alan">
          <label>Satır yayılma</label>
          <input
            name="satir_span"
            type="number"
            min="1"
            value={alanForm.satir_span}
            onChange={alanDegisti}
          />
        </div>
        <div className="form-alan">
          <label>Kolon yayılma</label>
          <input
            name="kolon_span"
            type="number"
            min="1"
            value={alanForm.kolon_span}
            onChange={alanDegisti}
          />
        </div>
        <div className="form-alan">
          <label>Kapasite (adet)</label>
          <input
            name="kapasite"
            type="number"
            step="0.01"
            value={alanForm.kapasite}
            onChange={alanDegisti}
          />
        </div>
        <button type="submit" disabled={alanGonderiliyor}>
          <Plus size={15} />{" "}
          {alanGonderiliyor
            ? "Kaydediliyor..."
            : duzenlenenId
              ? "Güncelle"
              : "Ekle"}
        </button>
        {duzenlenenId && (
          <button
            type="button"
            className="ikincil"
            onClick={() => {
              setDuzenlenenId(null);
              setAlanForm(BOS_ALAN);
            }}
          >
            Vazgeç
          </button>
        )}
      </form>

      <h2 className="bolum-basligi">Palet Bloğu Üret</h2>

      <form onSubmit={blokKaydet}>
        <div className="form-alan">
          <label>Blok kodu</label>
          <input
            name="blok"
            placeholder="L"
            value={blokForm.blok}
            onChange={blokDegisti}
            required
          />
        </div>
        <div className="form-alan">
          <label>İlk sıra no</label>
          <input
            name="sira_baslangic"
            type="number"
            min="1"
            value={blokForm.sira_baslangic}
            onChange={blokDegisti}
          />
        </div>
        <div className="form-alan">
          <label>Sıra sayısı</label>
          <input
            name="sira_sayisi"
            type="number"
            min="1"
            value={blokForm.sira_sayisi}
            onChange={blokDegisti}
            required
          />
        </div>
        <div className="form-alan">
          <label>Derinlik</label>
          <input
            name="derinlik"
            type="number"
            min="1"
            value={blokForm.derinlik}
            onChange={blokDegisti}
            required
          />
        </div>
        <div className="form-alan">
          <label>Kat</label>
          <input
            name="kat"
            type="number"
            min="1"
            value={blokForm.kat}
            onChange={blokDegisti}
            required
          />
        </div>
        <div className="form-alan">
          <label>Başlangıç satır</label>
          <input
            name="baslangic_satir"
            type="number"
            min="1"
            value={blokForm.baslangic_satir}
            onChange={blokDegisti}
          />
        </div>
        <div className="form-alan">
          <label>Başlangıç kolon</label>
          <input
            name="baslangic_kolon"
            type="number"
            min="1"
            value={blokForm.baslangic_kolon}
            onChange={blokDegisti}
          />
        </div>
        <div className="form-alan">
          <label>Derinlik genişliği</label>
          <input
            name="derinlik_genislik"
            type="number"
            min="1"
            value={blokForm.derinlik_genislik}
            onChange={blokDegisti}
          />
        </div>
        <div className="form-alan">
          <label>Sıralar yukarı doğru</label>
          <input
            name="ters"
            type="checkbox"
            checked={blokForm.ters}
            onChange={blokDegisti}
          />
        </div>
        <div className="form-alan">
          <label>Derinlik ters</label>
          <input
            name="derinlik_ters"
            type="checkbox"
            checked={blokForm.derinlik_ters}
            onChange={blokDegisti}
          />
        </div>
        <button type="submit" disabled={blokGonderiliyor}>
          <Grid3x3 size={15} />{" "}
          {blokGonderiliyor ? "Üretiliyor..." : "Blok Üret"}
        </button>
      </form>

      <h2 className="bolum-basligi">Lokasyonlar ({gorunenler.length})</h2>

      <div className="filtre-cubugu">
        <div className="form-alan">
          <label>Tip</label>
          <select
            value={tipFiltre}
            onChange={(e) => setTipFiltre(e.target.value)}
          >
            <option value="">Tümü</option>
            <option value="palet">Palet</option>
            <option value="alan">Alan</option>
            <option value="kabul">Mal Kabul</option>
            <option value="sevkiyat">Sevkiyat</option>
            <option value="koridor">Koridor</option>
            <option value="pazar">Pazar</option>
            <option value="ofis">Ofis</option>
          </select>
        </div>
        <div className="form-alan">
          <label>Blok</label>
          <select
            value={blokFiltre}
            onChange={(e) => setBlokFiltre(e.target.value)}
          >
            <option value="">Tümü</option>
            {bloklar.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Kod</th>
            <th>Ad</th>
            <th>Tip</th>
            <th>Konum</th>
            <th>Stok</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {sayfadakiler.map((l) => (
            <tr key={l.id}>
              <td>{l.kod}</td>
              <td>{l.ad || "-"}</td>
              <td>
                <Etiket deger={l.tip} />
              </td>
              <td className="kucuk-not">
                {l.satir}/{l.kolon}
                {(l.satir_span > 1 || l.kolon_span > 1) &&
                  ` · ${l.satir_span}×${l.kolon_span}`}
                {l.kat > 1 && ` · ${l.kat}. kat`}
              </td>
              <td>{Number(l.toplam_miktar).toFixed(0)}</td>
              <td>
                <button
                  className="ikincil ikon-btn"
                  onClick={() => duzenlemeyeBasla(l)}
                  title="Düzenle"
                  aria-label="Lokasyonu düzenle"
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="tehlike ikon-btn"
                  onClick={() => setSilinecek(l)}
                  title="Sil"
                  aria-label="Lokasyonu sil"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Sayfalama
        sayfa={gecerliSayfa}
        toplam={gorunenler.length}
        sayfaBoyutu={SAYFA_BOYUTU}
        degisti={setSayfa}
      />

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

export default LokasyonYonetimi;
