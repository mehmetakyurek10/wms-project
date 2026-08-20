import { useState } from "react";
import {
  kullanicilariGetir,
  kullaniciGuncelle,
  kullaniciSifreSifirla,
} from "../api/kullaniciApi";
import { kayitOl } from "../api/authApi";
import { useToast } from "../context/ToastContext";
import useAuth from "../hooks/useAuth";
import useFetch from "../hooks/useFetch";
import Etiket from "../components/Etiket";
import Modal from "../components/Modal";

function Kullanicilar() {
  const bildir = useToast();
  const { kullanici: mevcutKullanici } = useAuth();

  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sifirlanacak, setSifirlanacak] = useState(null);
  const [yeniSifre, setYeniSifre] = useState("");
  const [sifirlaniyor, setSifirlaniyor] = useState(false);
  const [form, setForm] = useState({
    ad: "",
    email: "",
    sifre: "",
    rol: "depo_sorumlusu",
  });

  const {
    data: kullanicilar,
    loading: yukleniyor,
    error: hata,
    refresh: veriGetir,
  } = useFetch(() => kullanicilariGetir(), [], {
    initial: [],
    errorMessage: "Kullanıcılar yüklenemedi",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (gonderiliyor) return;
    setGonderiliyor(true);
    try {
      await kayitOl(form);
      setForm({ ad: "", email: "", sifre: "", rol: "depo_sorumlusu" });
      bildir("Kullanıcı eklendi");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Kullanıcı eklenemedi", "hata");
    } finally {
      setGonderiliyor(false);
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

  const sifirlamaKapat = () => {
    setSifirlanacak(null);
    setYeniSifre("");
  };

  const sifreSifirlaGonder = async (e) => {
    e.preventDefault();
    if (sifirlaniyor) return;
    setSifirlaniyor(true);
    try {
      await kullaniciSifreSifirla(sifirlanacak.id, { yeniSifre });
      bildir(`${sifirlanacak.ad} için şifre sıfırlandı`);
      sifirlamaKapat();
    } catch (err) {
      bildir(err.response?.data?.hata || "Şifre sıfırlanamadı", "hata");
    } finally {
      setSifirlaniyor(false);
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
        <button type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? "Ekleniyor..." : "Ekle"}
        </button>
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
                  <button
                    className="ikincil"
                    onClick={() => setSifirlanacak(k)}
                    disabled={kendisi}
                    title={
                      kendisi
                        ? "Kendi şifreniz için Şifre Değiştir ekranını kullanın"
                        : ""
                    }
                  >
                    Şifre Sıfırla
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Modal
        acik={sifirlanacak !== null}
        kapat={sifirlamaKapat}
        baslik="Şifre sıfırla"
        kirli={yeniSifre.length > 0}
      >
        <h3>Şifre sıfırla</h3>
        <p className="kucuk-not">
          {sifirlanacak?.ad} için yeni bir şifre belirleyin. Kullanıcının açık
          oturumları kapanacak ve yeni şifreyle giriş yapması gerekecek.
        </p>

        <form onSubmit={sifreSifirlaGonder}>
          <div className="form-alan">
            <label>Yeni şifre</label>
            <input
              type="text"
              value={yeniSifre}
              onChange={(e) => setYeniSifre(e.target.value)}
              minLength={6}
              required
              autoFocus
            />
          </div>

          <button type="submit" disabled={sifirlaniyor}>
            {sifirlaniyor ? "Sıfırlanıyor..." : "Sıfırla"}
          </button>
          <button type="button" className="ikincil" onClick={sifirlamaKapat}>
            Vazgeç
          </button>
        </form>
      </Modal>
    </div>
  );
}

export default Kullanicilar;
