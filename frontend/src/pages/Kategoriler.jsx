import { useEffect, useState } from "react";
import { kategorileriGetir, kategoriEkle } from "../api/kategoriApi";

function Kategoriler() {
  const [kategoriler, setKategoriler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [formHata, setFormHata] = useState("");
  const [ad, setAd] = useState("");

  const veriGetir = async () => {
    try {
      const response = await kategorileriGetir();
      setKategoriler(response.data);
    } catch (err) {
      setHata("Kategoriler yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    veriGetir();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormHata("");
    try {
      await kategoriEkle({ ad });
      setAd("");
      veriGetir();
    } catch (err) {
      setFormHata(err.response?.data?.hata || "Kategori eklenemedi");
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
      <h2>Kategoriler</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <input
          placeholder="Kategori adı"
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          required
        />
        <button type="submit">Ekle</button>
        {formHata && <p style={{ color: "red" }}>{formHata}</p>}
      </form>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Ad</th>
          </tr>
        </thead>
        <tbody>
          {kategoriler.map((kategori) => (
            <tr key={kategori.id}>
              <td>{kategori.ad}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Kategoriler;
