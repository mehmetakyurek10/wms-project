import { useEffect, useState } from "react";
import {
  stokHareketleriniGetir,
  stokHareketiEkle,
} from "../api/stokHareketleri";
import { varyantlariGetir } from "../api/varyantApi";
import Etiket from "../components/Etiket";
import { useToast } from "../context/ToastContext";

function StokHareketleri() {
  const bildir = useToast();
  const [hareketler, setHareketler] = useState([]);
  const [varyantlar, setVaryantlar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [form, setForm] = useState({
    varyant_id: "",
    tip: "giris",
    miktar: "",
    aciklama: "",
  });

  const veriGetir = async () => {
    try {
      const [hareketRes, varyantRes] = await Promise.all([
        stokHareketleriniGetir(),
        varyantlariGetir(),
      ]);
      setHareketler(hareketRes.data);
      setVaryantlar(varyantRes.data);
      setForm((f) =>
        f.varyant_id ? f : { ...f, varyant_id: varyantRes.data[0]?.id || "" },
      );
    } catch (err) {
      setHata("Veriler yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    veriGetir();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await stokHareketiEkle(form);
      setForm({ ...form, miktar: "", aciklama: "" });
      bildir("Stok hareketi kaydedildi");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Hareket eklenemedi", "hata");
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
      <h2>Stok Hareketleri</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-alan">
          <label>Varyant</label>
          <select
            name="varyant_id"
            value={form.varyant_id}
            onChange={handleChange}
            required
          >
            <option value="">Seçiniz</option>
            {varyantlar.map((v) => (
              <option key={v.id} value={v.id}>
                {v.urun_adi} · {v.boy} · {v.ambalaj_kg}kg {v.ambalaj_tipi}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alan">
          <label>Hareket tipi</label>
          <select name="tip" value={form.tip} onChange={handleChange}>
            <option value="giris">Giriş</option>
            <option value="cikis">Çıkış</option>
            <option value="duzeltme">Düzeltme</option>
          </select>
        </div>

        <div className="form-alan">
          <label>Miktar (adet)</label>
          <input
            name="miktar"
            type="number"
            step="0.01"
            value={form.miktar}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-alan">
          <label>Açıklama</label>
          <input
            name="aciklama"
            placeholder="İsteğe bağlı"
            value={form.aciklama}
            onChange={handleChange}
          />
        </div>

        <button type="submit">Kaydet</button>
      </form>

      {hareketler.length === 0 ? (
        <div className="bos-durum">Henüz stok hareketi yok.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Ürün</th>
              <th>Varyant</th>
              <th>Tip</th>
              <th>Miktar</th>
              <th>Açıklama</th>
              <th>İşlemi Yapan</th>
            </tr>
          </thead>
          <tbody>
            {hareketler.map((h) => (
              <tr key={h.id}>
                <td>{new Date(h.tarih).toLocaleString("tr-TR")}</td>
                <td>{h.urun_adi}</td>
                <td>
                  {h.boy} · {h.ambalaj_kg}kg {h.ambalaj_tipi}
                </td>
                <td>
                  <Etiket deger={h.tip} />
                </td>
                <td>{h.miktar}</td>
                <td>{h.aciklama}</td>
                <td>{h.kullanici_adi || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default StokHareketleri;
