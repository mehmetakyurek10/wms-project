import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import {
  varyantlariGetir,
  varyantEkle,
  varyantGuncelle,
  varyantSil,
} from "../api/varyantApi";
import { urunleriGetir } from "../api/urunApi";
import { kategorileriGetir } from "../api/kategoriApi";
import { useToast } from "../context/ToastContext";
import OnayModal from "../components/OnayModal";

const SAYFA_BOYUTU = 20;

const BOS_FILTRE = {
  kategori_id: "",
  urun_id: "",
  aktif: "",
  sadece_dusuk: "",
};

function Varyantlar() {
  const bildir = useToast();
  const [varyantlar, setVaryantlar] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [kategoriler, setKategoriler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");

  const [arama, setArama] = useState("");
  const [aranan, setAranan] = useState("");
  const [filtre, setFiltre] = useState(BOS_FILTRE);
  const [sayfa, setSayfa] = useState(1);
  const [toplam, setToplam] = useState(0);

  const [silinecek, setSilinecek] = useState(null);
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [duzenlemeForm, setDuzenlemeForm] = useState({});
  const [form, setForm] = useState({
    urun_id: "",
    boy: "",
    ambalaj_tipi: "kova",
    ambalaj_kg: 10,
    barkod: "",
    barkod: "",
    miktar: 0,
    birim: "adet",
    kritik_seviye: 0,
    birim_fiyat: 0,
  });

  const toplamSayfa = Math.ceil(toplam / SAYFA_BOYUTU);
  const filtreVar =
    aranan !== "" || Object.values(filtre).some((deger) => deger !== "");

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
      const response = await varyantlariGetir({
        ...filtre,
        ara: aranan || undefined,
        sayfa,
        limit: SAYFA_BOYUTU,
      });
      setVaryantlar(response.data);
      setToplam(parseInt(response.headers["x-toplam-kayit"], 10) || 0);
    } catch (err) {
      setHata("Varyantlar yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    tanimlariYukle();
  }, []);

  useEffect(() => {
    const zamanlayici = setTimeout(() => {
      setAranan(arama);
      setSayfa(1);
    }, 400);
    return () => clearTimeout(zamanlayici);
  }, [arama]);

  useEffect(() => {
    varyantlariYukle();
  }, [aranan, filtre, sayfa]);

  const filtreDegisti = (e) => {
    setFiltre({ ...filtre, [e.target.name]: e.target.value });
    setSayfa(1);
  };

  const filtreleriTemizle = () => {
    setFiltre(BOS_FILTRE);
    setArama("");
    setSayfa(1);
  };

  const ambalajKg = Number(form.ambalaj_kg) || 1;
  const miktarAdet =
    form.birim === "kg"
      ? Number(form.miktar || 0) / ambalajKg
      : Number(form.miktar || 0);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await varyantEkle({
        urun_id: form.urun_id,
        boy: form.boy,
        ambalaj_tipi: form.ambalaj_tipi,
        ambalaj_kg: form.ambalaj_kg,
        barkod: form.barkod,
        miktar: miktarAdet,
        kritik_seviye: form.kritik_seviye,
        birim_fiyat: form.birim_fiyat,
      });
      setForm({ ...form, boy: "", barkod: "", miktar: 0 });
      bildir("Varyant eklendi");
      varyantlariYukle();
    } catch (err) {
      bildir(err.response?.data?.hata || "Varyant eklenemedi", "hata");
    }
  };

  const duzenlemeyeBasla = (v) => {
    setDuzenlenenId(v.id);
    setDuzenlemeForm({
      boy: v.boy,
      ambalaj_tipi: v.ambalaj_tipi,
      ambalaj_kg: v.ambalaj_kg,
      barkod: v.barkod || "",
      kritik_seviye: v.kritik_seviye,
      birim_fiyat: v.birim_fiyat,
      aktif: v.aktif,
    });
  };

  const duzenlemeKaydet = async (id) => {
    try {
      await varyantGuncelle(id, duzenlemeForm);
      setDuzenlenenId(null);
      bildir("Varyant güncellendi");
      varyantlariYukle();
    } catch (err) {
      bildir(err.response?.data?.hata || "Güncellenemedi", "hata");
    }
  };

  const silOnayla = async () => {
    const id = silinecek.id;
    setSilinecek(null);
    try {
      await varyantSil(id);
      bildir("Varyant silindi");
      varyantlariYukle();
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

  return (
    <div>
      <h2>Stok Kalemleri</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-alan">
          <label>Ürün</label>
          <select
            name="urun_id"
            value={form.urun_id}
            onChange={handleChange}
            required
          >
            <option value="">Seçiniz</option>
            {urunler.map((u) => (
              <option key={u.id} value={u.id}>
                {u.kategori_adi ? `${u.kategori_adi} · ` : ""}
                {u.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alan">
          <label>Boy (kalibre)</label>
          <input
            name="boy"
            placeholder="201/230"
            value={form.boy}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-alan">
          <label>Ambalaj</label>
          <select
            name="ambalaj_tipi"
            value={form.ambalaj_tipi}
            onChange={handleChange}
          >
            <option value="kova">Kova</option>
            <option value="teneke">Teneke</option>
          </select>
        </div>

        <div className="form-alan">
          <label>Ambalaj kg</label>
          <input
            name="ambalaj_kg"
            type="number"
            step="0.1"
            value={form.ambalaj_kg}
            onChange={handleChange}
          />
        </div>

        <div className="form-alan">
          <label>Barkod</label>
          <input
            name="barkod"
            placeholder="İsteğe bağlı"
            value={form.barkod}
            onChange={handleChange}
          />
        </div>

        <div className="form-alan">
          <label>Başlangıç stoğu</label>
          <div className="miktar-girisi">
            <input
              name="miktar"
              type="number"
              step="0.01"
              value={form.miktar}
              onChange={handleChange}
            />
            <select name="birim" value={form.birim} onChange={handleChange}>
              <option value="adet">adet</option>
              <option value="kg">kg</option>
            </select>
          </div>
          {form.birim === "kg" && Number(form.miktar) > 0 && (
            <span className="kucuk-not">= {miktarAdet.toFixed(2)} adet</span>
          )}
        </div>

        <div className="form-alan">
          <label>Kritik seviye (adet)</label>
          <input
            name="kritik_seviye"
            type="number"
            step="0.01"
            value={form.kritik_seviye}
            onChange={handleChange}
          />
        </div>

        <div className="form-alan">
          <label>Birim fiyat (adet)</label>
          <input
            name="birim_fiyat"
            type="number"
            step="0.01"
            value={form.birim_fiyat}
            onChange={handleChange}
          />
        </div>

        <button type="submit">Ekle</button>
      </form>

      <div className="arama-kutusu">
        <Search size={16} />
        <input
          placeholder="Ürün, boy veya barkod ara..."
          value={arama}
          onChange={(e) => setArama(e.target.value)}
        />
      </div>

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
          <label>Durum</label>
          <select name="aktif" value={filtre.aktif} onChange={filtreDegisti}>
            <option value="">Tümü</option>
            <option value="1">Aktif</option>
            <option value="0">Pasif</option>
          </select>
        </div>

        <div className="form-alan">
          <label>Stok</label>
          <select
            name="sadece_dusuk"
            value={filtre.sadece_dusuk}
            onChange={filtreDegisti}
          >
            <option value="">Tümü</option>
            <option value="1">Sadece kritik</option>
          </select>
        </div>

        {filtreVar && (
          <button
            className="ikincil ikon-btn"
            onClick={filtreleriTemizle}
            title="Filtreleri temizle"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {varyantlar.length === 0 ? (
        <div className="bos-durum">
          {filtreVar
            ? "Bu filtrelere uyan stok kalemi yok."
            : "Henüz stok kalemi eklenmemiş."}
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Boy</th>
                <th>Ambalaj</th>
                <th>Stok (adet)</th>
                <th>Toplam kg</th>
                <th>Kritik (adet)</th>
                <th>Barkod</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {varyantlar.map((v) =>
                duzenlenenId === v.id ? (
                  <tr key={v.id}>
                    <td>{v.urun_adi}</td>
                    <td>
                      <input
                        value={duzenlemeForm.boy}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            boy: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={duzenlemeForm.ambalaj_tipi}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            ambalaj_tipi: e.target.value,
                          })
                        }
                      >
                        <option value="kova">Kova</option>
                        <option value="teneke">Teneke</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="—"
                        value={duzenlemeForm.paletteki_adet}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            paletteki_adet: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>{Number(v.miktar).toFixed(0)}</td>
                    <td>
                      {(Number(v.miktar) * Number(v.ambalaj_kg)).toFixed(0)} kg
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={duzenlemeForm.kritik_seviye}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            kritik_seviye: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={duzenlemeForm.barkod}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            barkod: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <button onClick={() => duzenlemeKaydet(v.id)}>
                        Kaydet
                      </button>
                      <button
                        className="ikincil"
                        onClick={() => setDuzenlenenId(null)}
                      >
                        İptal
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={v.id}
                    className={
                      parseFloat(v.miktar) <= parseFloat(v.kritik_seviye)
                        ? "kritik"
                        : ""
                    }
                  >
                    <td>{v.urun_adi}</td>
                    <td>{v.boy}</td>
                    <td>
                      {Number(v.ambalaj_kg)} kg {v.ambalaj_tipi}
                    </td>
                    <td>{v.paletteki_adet ?? "—"}</td>
                    <td>{Number(v.miktar).toFixed(0)}</td>
                    <td>
                      {(Number(v.miktar) * Number(v.ambalaj_kg)).toFixed(0)} kg
                    </td>
                    <td>{Number(v.kritik_seviye).toFixed(0)}</td>
                    <td>{v.barkod || "-"}</td>
                    <td>
                      <button onClick={() => duzenlemeyeBasla(v)}>
                        Düzenle
                      </button>
                      <button
                        onClick={() => setSilinecek(v)}
                        className="tehlike"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>

          {toplam > SAYFA_BOYUTU && (
            <div className="sayfalama">
              <button
                onClick={() => setSayfa(sayfa - 1)}
                disabled={sayfa === 1}
              >
                Önceki
              </button>
              <span>
                Sayfa {sayfa} / {toplamSayfa} · Toplam {toplam} kayıt
              </span>
              <button
                onClick={() => setSayfa(sayfa + 1)}
                disabled={sayfa >= toplamSayfa}
              >
                Sonraki
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Varyantlar;
