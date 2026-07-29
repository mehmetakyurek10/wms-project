import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  varyantlariGetir,
  varyantEkle,
  varyantGuncelle,
  varyantSil,
} from "../api/varyantApi";
import { urunleriGetir } from "../api/urunApi";
import { useToast } from "../context/ToastContext";
import OnayModal from "../components/OnayModal";

function Varyantlar() {
  const bildir = useToast();
  const [varyantlar, setVaryantlar] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [arama, setArama] = useState("");
  const [aranan, setAranan] = useState("");
  const [silinecek, setSilinecek] = useState(null);
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [duzenlemeForm, setDuzenlemeForm] = useState({});
  const [form, setForm] = useState({
    urun_id: "",
    boy: "",
    ambalaj_tipi: "kova",
    ambalaj_kg: 10,
    barkod: "",
    miktar: 0,
    kritik_seviye: 0,
    birim_fiyat: 0,
  });

  const veriGetir = async () => {
    try {
      const [varyantRes, urunRes] = await Promise.all([
        varyantlariGetir(aranan ? { ara: aranan } : undefined),
        urunleriGetir(),
      ]);
      setVaryantlar(varyantRes.data);
      setUrunler(urunRes.data);
    } catch (err) {
      setHata("Veriler yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    const zamanlayici = setTimeout(() => setAranan(arama), 400);
    return () => clearTimeout(zamanlayici);
  }, [arama]);

  useEffect(() => {
    veriGetir();
  }, [aranan]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await varyantEkle(form);
      setForm({ ...form, boy: "", barkod: "", miktar: 0 });
      bildir("Varyant eklendi");
      veriGetir();
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
      veriGetir();
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

  return (
    <div>
      <h2>Stok (Varyantlar)</h2>

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
          <input
            name="miktar"
            type="number"
            step="0.01"
            value={form.miktar}
            onChange={handleChange}
          />
        </div>

        <div className="form-alan">
          <label>Kritik seviye</label>
          <input
            name="kritik_seviye"
            type="number"
            step="0.01"
            value={form.kritik_seviye}
            onChange={handleChange}
          />
        </div>

        <div className="form-alan">
          <label>Birim fiyat</label>
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

      {varyantlar.length === 0 ? (
        <div className="bos-durum">
          {aranan
            ? `"${aranan}" için sonuç bulunamadı.`
            : "Henüz varyant eklenmemiş."}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Boy</th>
              <th>Ambalaj</th>
              <th>Stok</th>
              <th>Toplam kg</th>
              <th>Kritik</th>
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
                  <td>{v.miktar}</td>
                  <td>-</td>
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
                    {v.ambalaj_kg} kg {v.ambalaj_tipi}
                  </td>
                  <td>{v.miktar}</td>
                  <td>
                    {(parseFloat(v.miktar) * parseFloat(v.ambalaj_kg)).toFixed(
                      0,
                    )}{" "}
                    kg
                  </td>
                  <td>{v.kritik_seviye}</td>
                  <td>{v.barkod || "-"}</td>
                  <td>
                    <button onClick={() => duzenlemeyeBasla(v)}>Düzenle</button>
                    <button onClick={() => setSilinecek(v)} className="tehlike">
                      Sil
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      <OnayModal
        acik={silinecek !== null}
        baslik="Varyantı sil"
        mesaj={`${silinecek?.urun_adi} · ${silinecek?.boy} · ${silinecek?.ambalaj_tipi} varyantı silinecek.`}
        onayla={silOnayla}
        iptal={() => setSilinecek(null)}
      />
    </div>
  );
}

export default Varyantlar;
