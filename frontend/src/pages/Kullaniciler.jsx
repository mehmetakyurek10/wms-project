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
import OnayModal from "../components/OnayModal";
import Modal from "../components/Modal";
import ErrorState from "../components/ErrorState";

function Kullanicilar() {
  const bildir = useToast();
  const { kullanici: mevcutKullanici } = useAuth();

  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sifirlanacak, setSifirlanacak] = useState(null);
  const [rolDegisimi, setRolDegisimi] = useState(null);
  const [pasifeAlinacak, setPasifeAlinacak] = useState(null);
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

  const rolSecildi = (kullanici, yeniRol) => {
    if (kullanici.rol === yeniRol) return;
    setRolDegisimi({ kullanici, yeniRol });
  };

  const rolOnayla = async () => {
    const { kullanici, yeniRol } = rolDegisimi;
    setRolDegisimi(null);

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

  // Aktiflestirme erisim verir ve geri alinabilir, onay istemez. Pasife
  // alma kullanicinin sisteme girisini keser; asimetrik risk.
  const durumSecildi = (kullanici) => {
    if (kullanici.aktif) {
      setPasifeAlinacak(kullanici);
      return;
    }
    durumDegistir(kullanici);
  };

  const pasifeAlOnayla = async () => {
    const kullanici = pasifeAlinacak;
    setPasifeAlinacak(null);
    await durumDegistir(kullanici);
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
  if (hata) return <ErrorState mesaj={hata} tekrarDene={veriGetir} />;

  return (
    <div>
      <h2>Kullanıcılar</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-alan">
          <label htmlFor="kullaniciler-ad-soyad">Ad Soyad</label>
          <input
            id="kullaniciler-ad-soyad"
            name="ad"
            value={form.ad}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-alan">
          <label htmlFor="kullaniciler-e-posta">E-posta</label>
          <input
            id="kullaniciler-e-posta"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-alan">
          <label htmlFor="kullaniciler-sifre">Şifre</label>
          <input
            id="kullaniciler-sifre"
            name="sifre"
            type="password"
            value={form.sifre}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-alan">
          <label htmlFor="kullaniciler-rol">Rol</label>
          <select
            id="kullaniciler-rol"
            name="rol"
            value={form.rol}
            onChange={handleChange}
          >
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
                    onChange={(e) => rolSecildi(k, e.target.value)}
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
                    onClick={() => durumSecildi(k)}
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

      <OnayModal
        acik={pasifeAlinacak !== null}
        baslik="Kullanıcıyı pasife al"
        mesaj={`${pasifeAlinacak?.ad} pasife alınacak ve sisteme giriş yapamayacak. Kayıtları ve geçmiş işlemleri silinmez, istediğiniz zaman yeniden aktifleştirebilirsiniz.`}
        onayMetni="Pasife al"
        onayla={pasifeAlOnayla}
        iptal={() => setPasifeAlinacak(null)}
      />

      <OnayModal
        acik={rolDegisimi !== null}
        baslik="Rolü değiştir"
        mesaj={
          rolDegisimi?.yeniRol === "admin"
            ? `${rolDegisimi?.kullanici.ad} yönetici yapılacak. Yönetici tüm kullanıcıları, lokasyonları ve sistem sağlığını yönetebilir, kayıt silebilir.`
            : `${rolDegisimi?.kullanici.ad} depo sorumlusu yapılacak, yönetici yetkileri kaldırılacak.`
        }
        onayMetni="Değiştir"
        onayla={rolOnayla}
        iptal={() => setRolDegisimi(null)}
      />

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
            <label htmlFor="kullaniciler-yeni-sifre">Yeni şifre</label>
            <input
              id="kullaniciler-yeni-sifre"
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
