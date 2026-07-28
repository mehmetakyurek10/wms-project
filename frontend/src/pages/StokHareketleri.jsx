import { useEffect, useState } from "react";
import {
  stokHareketleriniGetir,
  stokHareketiEkle,
} from "../api/stokHareketleri";
import { urunleriGetir } from "../api/urunApi";
import Etiket from "../components/Etiket";
import { useToast } from "../context/ToastContext";

function StokHareketleri() {
  const bildir = useToast();
  const [hareketler, setHareketler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [form, setForm] = useState({
    urun_id: "",
    tip: "giris",
    miktar: "",
    aciklama: "",
  });

  const veriGetir = async () => {
    try {
      const [hareketRes, urunRes] = await Promise.all([
        stokHareketleriniGetir(),
        urunleriGetir(),
      ]);
      setHareketler(hareketRes.data);
      setUrunler(urunRes.data);
      setForm((f) =>
        f.urun_id ? f : { ...f, urun_id: urunRes.data[0]?.id || "" },
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
        <select name="urun_id" value={form.urun_id} onChange={handleChange}>
          {urunler.map((u) => (
            <option key={u.id} value={u.id}>
              {u.ad}
            </option>
          ))}
        </select>
        <select name="tip" value={form.tip} onChange={handleChange}>
          <option value="giris">Giriş</option>
          <option value="cikis">Çıkış</option>
          <option value="duzeltme">Düzeltme</option>
        </select>
        <input
          name="miktar"
          type="number"
          step="0.01"
          placeholder="Miktar"
          value={form.miktar}
          onChange={handleChange}
          required
        />
        <input
          name="aciklama"
          placeholder="Açıklama"
          value={form.aciklama}
          onChange={handleChange}
        />
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
