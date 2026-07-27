import { useEffect, useState } from "react";
import {
  stokHareketleriniGetir,
  stokHareketiEkle,
} from "../api/stokHareketleri";
import { urunleriGetir } from "../api/urunApi";

function StokHareketleri() {
  const [hareketler, setHareketler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [formHata, setFormHata] = useState("");
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
    setFormHata("");
    try {
      await stokHareketiEkle(form);
      setForm({ ...form, miktar: "", aciklama: "" });
      veriGetir();
    } catch (err) {
      setFormHata(err.response?.data?.hata || "Hareket eklenemedi");
    }
  };

  if (yukleniyor)
    return (
      <div className="yukleniyor-kutu">
        <div className="spinner" />
        <span>Yükleniyor...</span>
      </div>
    );
  if (hata) return <p style={{ color: "red" }}>{hata}</p>;

  return (
    <div>
      <h2>Stok Hareketleri</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
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
        {formHata && <p style={{ color: "red" }}>{formHata}</p>}
      </form>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Ürün</th>
            <th>Tip</th>
            <th>Miktar</th>
            <th>Açıklama</th>
          </tr>
        </thead>
        <tbody>
          {hareketler.map((h) => (
            <tr key={h.id}>
              <td>{new Date(h.tarih).toLocaleString("tr-TR")}</td>
              <td>{h.urun_adi}</td>
              <td>{h.tip}</td>
              <td>{h.miktar}</td>
              <td>{h.aciklama}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StokHareketleri;
