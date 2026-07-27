import { useEffect, useState } from "react";
import {
  tedarikcileriGetir,
  tedarikciEkle,
  tedarikciGuncelle,
  tedarikciSil,
} from "../api/tedarikciApi";

function Tedarikciler() {
  const [tedarikciler, setTedarikciler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [formHata, setFormHata] = useState("");
  const [form, setForm] = useState({
    ad: "",
    yetkili_kisi: "",
    telefon: "",
    email: "",
    adres: "",
  });
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [duzenlemeForm, setDuzenlemeForm] = useState({});

  const veriGetir = async () => {
    try {
      const response = await tedarikcileriGetir();
      setTedarikciler(response.data);
    } catch (err) {
      setHata("Tedarikçiler yüklenemedi");
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
      await tedarikciEkle(form);
      setForm({ ad: "", yetkili_kisi: "", telefon: "", email: "", adres: "" });
      veriGetir();
    } catch (err) {
      setFormHata(err.response?.data?.hata || "Tedarikçi eklenemedi");
    }
  };

  const duzenlemeyeBasla = (tedarikci) => {
    setDuzenlenenId(tedarikci.id);
    setDuzenlemeForm({
      ad: tedarikci.ad,
      yetkili_kisi: tedarikci.yetkili_kisi || "",
      telefon: tedarikci.telefon || "",
      email: tedarikci.email || "",
      adres: tedarikci.adres || "",
    });
  };

  const duzenlemeKaydet = async (id) => {
    try {
      await tedarikciGuncelle(id, duzenlemeForm);
      setDuzenlenenId(null);
      veriGetir();
    } catch (err) {
      alert(err.response?.data?.hata || "Güncellenemedi");
    }
  };

  const sil = async (id) => {
    if (!window.confirm("Bu tedarikçiyi silmek istediğine emin misin?")) return;
    try {
      await tedarikciSil(id);
      veriGetir();
    } catch (err) {
      alert(err.response?.data?.hata || "Silinemedi");
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
      <h2>Tedarikçiler</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <input
          name="ad"
          placeholder="Tedarikçi adı"
          value={form.ad}
          onChange={handleChange}
          required
        />
        <input
          name="yetkili_kisi"
          placeholder="Yetkili kişi"
          value={form.yetkili_kisi}
          onChange={handleChange}
        />
        <input
          name="telefon"
          placeholder="Telefon"
          value={form.telefon}
          onChange={handleChange}
        />
        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
        />
        <input
          name="adres"
          placeholder="Adres"
          value={form.adres}
          onChange={handleChange}
        />
        <button type="submit">Ekle</button>
        {formHata && <p style={{ color: "red" }}>{formHata}</p>}
      </form>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Ad</th>
            <th>Yetkili</th>
            <th>Telefon</th>
            <th>Email</th>
            <th>Adres</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {tedarikciler.map((t) =>
            duzenlenenId === t.id ? (
              <tr key={t.id}>
                <td>
                  <input
                    value={duzenlemeForm.ad}
                    onChange={(e) =>
                      setDuzenlemeForm({ ...duzenlemeForm, ad: e.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    value={duzenlemeForm.yetkili_kisi}
                    onChange={(e) =>
                      setDuzenlemeForm({
                        ...duzenlemeForm,
                        yetkili_kisi: e.target.value,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={duzenlemeForm.telefon}
                    onChange={(e) =>
                      setDuzenlemeForm({
                        ...duzenlemeForm,
                        telefon: e.target.value,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={duzenlemeForm.email}
                    onChange={(e) =>
                      setDuzenlemeForm({
                        ...duzenlemeForm,
                        email: e.target.value,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={duzenlemeForm.adres}
                    onChange={(e) =>
                      setDuzenlemeForm({
                        ...duzenlemeForm,
                        adres: e.target.value,
                      })
                    }
                  />
                </td>
                <td>
                  <button onClick={() => duzenlemeKaydet(t.id)}>Kaydet</button>
                  <button onClick={() => setDuzenlenenId(null)}>İptal</button>
                </td>
              </tr>
            ) : (
              <tr key={t.id}>
                <td>{t.ad}</td>
                <td>{t.yetkili_kisi}</td>
                <td>{t.telefon}</td>
                <td>{t.email}</td>
                <td>{t.adres}</td>
                <td>
                  <button onClick={() => duzenlemeyeBasla(t)}>Düzenle</button>
                  <button
                    onClick={() => sil(t.id)}
                    style={{ backgroundColor: "#dc2626" }}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Tedarikciler;
