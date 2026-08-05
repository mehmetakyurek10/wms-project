import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { kullanicilariGetir, kullaniciGuncelle } from "../api/kullaniciApi";
import { kayitOl } from "../api/authApi";
import { useToast } from "../context/ToastContext";
import Etiket from "../components/Etiket";

function Kullanicilar() {
  const bildir = useToast();
  const mevcutKullanici = JSON.parse(
    localStorage.getItem("kullanici") || "null",
  );
  const [kullanicilar, setKullanicilar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [form, setForm] = useState({
    ad: "",
    email: "",
    sifre: "",
    rol: "depo_sorumlusu",
  });

  const veriGetir = async () => {
    try {
      const response = await kullanicilariGetir();
      setKullanicilar(response.data);
    } catch (err) {
      setHata(err.response?.data?.hata || "Kullanıcılar yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    veriGetir();
  }, []);

  if (mevcutKullanici?.rol !== "admin") {
    return <Navigate to="/panel" />;
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await kayitOl(form);
      setForm({ ad: "", email: "", sifre: "", rol: "depo_sorumlusu" });
      bildir("Kullanıcı eklendi");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Kullanıcı eklenemedi", "hata");
    }
  };

  const rolDegistir = async (kullanici, yeniRol) => {
    try {
      await kullaniciGuncelle(kullanici.id, {
        rol: yeniRol,
        aktif: kullanici.aktif,
      });
      bildir("Rol güncellendi");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Güncellenemedi", "hata");
    }
  };

  const durumDegistir = async (kullanici) => {
    try {
      await kullaniciGuncelle(kullanici.id, {
        rol: kullanici.rol,
        aktif: kullanici.aktif ? 0 : 1,
      });
      bildir(
        kullanici.aktif
          ? "Kullanıcı pasife alındı"
          : "Kullanıcı aktifleştirildi",
      );
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Güncellenemedi", "hata");
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
      <h2>Kullanıcılar</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-alan">
          <label>Ad Soyad</label>
          <input name="ad" value={form.ad} onChange={handleChange} required />
        </div>
        <div className="form-alan">
          <label>E-posta</label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-alan">
          <label>Şifre</label>
          <input
            name="sifre"
            type="password"
            value={form.sifre}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-alan">
          <label>Rol</label>
          <select name="rol" value={form.rol} onChange={handleChange}>
            <option value="depo_sorumlusu">Depo Sorumlusu</option>
            <option value="admin">Yönetici</option>
          </select>
        </div>
        <button type="submit">Ekle</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Ad</th>
            <th>E-posta</th>
            <th>Rol</th>
            <th>Durum</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {kullanicilar.map((k) => {
            const kendisi = k.id === mevcutKullanici.id;
            return (
              <tr key={k.id}>
                <td>
                  {k.ad}
                  {kendisi && <span className="kucuk-not"> (siz)</span>}
                </td>
                <td>{k.email}</td>
                <td>
                  <select
                    value={k.rol}
                    disabled={kendisi}
                    onChange={(e) => rolDegistir(k, e.target.value)}
                  >
                    <option value="depo_sorumlusu">Depo Sorumlusu</option>
                    <option value="admin">Yönetici</option>
                  </select>
                </td>
                <td>
                  <Etiket deger={k.aktif ? "aktif" : "pasif"} />
                </td>
                <td>
                  <button
                    onClick={() => durumDegistir(k)}
                    disabled={kendisi}
                    className={k.aktif ? "tehlike" : ""}
                    title={kendisi ? "Kendi durumunuzu değiştiremezsiniz" : ""}
                  >
                    {k.aktif ? "Pasife Al" : "Aktifleştir"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default Kullanicilar;
