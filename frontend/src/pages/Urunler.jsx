import { useEffect, useState } from "react";
import { urunleriGetir, urunEkle } from "../api/urunApi";

function Urunler() {
  const [urunler, setUrunler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [formHata, setFormHata] = useState("");
  const [form, setForm] = useState({
    ad: "",
    miktar: "",
    birim: "kg",
    kritik_seviye: "",
  });

  const veriGetir = async () => {
    try {
      const response = await urunleriGetir();
      setUrunler(response.data);
    } catch (err) {
      setHata("Ürünler yüklenemedi");
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
      await urunEkle(form);
      setForm({ ad: "", miktar: "", birim: "kg", kritik_seviye: "" });
      veriGetir();
    } catch (err) {
      setFormHata(err.response?.data?.hata || "Ürün eklenemedi");
    }
  };

  if (yukleniyor) return <p>Yükleniyor...</p>;
  if (hata) return <p style={{ color: "red" }}>{hata}</p>;

  return (
    <div>
      <h2>Ürünler</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <input
          name="ad"
          placeholder="Ürün adı"
          value={form.ad}
          onChange={handleChange}
          required
        />
        <input
          name="miktar"
          type="number"
          placeholder="Miktar"
          value={form.miktar}
          onChange={handleChange}
        />
        <input
          name="birim"
          placeholder="Birim"
          value={form.birim}
          onChange={handleChange}
        />
        <input
          name="kritik_seviye"
          type="number"
          placeholder="Kritik seviye"
          value={form.kritik_seviye}
          onChange={handleChange}
        />
        <button type="submit">Ekle</button>
        {formHata && <p style={{ color: "red" }}>{formHata}</p>}
      </form>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Ad</th>
            <th>Miktar</th>
            <th>Birim</th>
            <th>Kritik Seviye</th>
          </tr>
        </thead>
        <tbody>
          {urunler.map((urun) => (
            <tr key={urun.id}>
              <td>{urun.ad}</td>
              <td>{urun.miktar}</td>
              <td>{urun.birim}</td>
              <td>{urun.kritik_seviye}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Urunler;
