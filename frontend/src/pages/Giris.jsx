import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import {
  Warehouse,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sun,
  Moon,
} from "lucide-react";
import { girisYap, kayitOl, kurulumDurumu } from "../api/authApi";
import useAuth from "../hooks/useAuth";
import useFetch from "../hooks/useFetch";

function Giris() {
  const navigate = useNavigate();
  const { kullanici, hazir, oturumAc } = useAuth();
  const [ad, setAd] = useState("");
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [sifreTekrar, setSifreTekrar] = useState("");
  const [sifreGorunur, setSifreGorunur] = useState(false);
  const [hata, setHata] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [tema, setTema] = useState(
    () => document.documentElement.getAttribute("data-tema") || "dark",
  );

  // Sunucuya ulasilamazsa varsayilan olarak giris formu gosteriliyor;
  // kullanici denedigi anda gercek hatayi zaten gorecek.
  const { data: kurulum, loading: kurulumYukleniyor } = useFetch(
    () => kurulumDurumu(),
    [],
    { initial: { ilkKurulum: false }, errorMessage: "" },
  );

  const ilkKurulum = kurulum.ilkKurulum;

  const [bilgi, setBilgi] = useState(() =>
    sessionStorage.getItem("oturumBitti")
      ? "Oturum süresi doldu, lütfen tekrar giriş yapın."
      : "",
  );

  useEffect(() => {
    sessionStorage.removeItem("oturumBitti");
  }, []);

  const temaDegistir = () => {
    const yeni = tema === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-tema", yeni);
    localStorage.setItem("tema", yeni);
    setTema(yeni);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setHata("");
    setBilgi("");

    if (ilkKurulum && sifre !== sifreTekrar) {
      setHata("Şifreler eşleşmiyor");
      return;
    }

    setGonderiliyor(true);
    try {
      // Ilk kurulumda hesap olusturulup hemen giris yapiliyor; kullaniciyi
      // yeni yazdigi sifreyi tekrar girmeye zorlamanin anlami yok.
      if (ilkKurulum) {
        await kayitOl({ ad, email, sifre });
      }

      const response = await girisYap(email, sifre);
      oturumAc(response.data);
      navigate("/panel");
    } catch (err) {
      setHata(
        err.response?.data?.hata ||
          (ilkKurulum ? "Hesap oluşturulamadı" : "Giriş başarısız"),
      );
    } finally {
      setGonderiliyor(false);
    }
  };

  if (hazir && kullanici) {
    return <Navigate to="/panel" replace />;
  }

  return (
    <div className="giris-sayfasi">
      <button
        className="ikincil ikon-btn giris-tema"
        onClick={temaDegistir}
        title="Tema değiştir"
      >
        {tema === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      <div className="giris-karti">
        <div className="giris-marka">
          <Warehouse size={26} />
          <span>WMS</span>
        </div>

        <h1>{ilkKurulum ? "İlk Kurulum" : "Depo Yönetim Sistemi"}</h1>
        <p className="giris-alt-baslik">
          {ilkKurulum
            ? "Yönetici hesabını oluşturun"
            : "Devam etmek için giriş yapın"}
        </p>

        {bilgi && <p className="bilgi-metni">{bilgi}</p>}
        {hata && <p className="hata-kutusu">{hata}</p>}

        {kurulumYukleniyor ? (
          <div className="yukleniyor-kutu">
            <div className="spinner" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="giris-form">
            {ilkKurulum && (
              <div className="form-alan">
                <label>Ad Soyad</label>
                <div className="ikonlu-giris">
                  <User size={16} />
                  <input
                    placeholder="Adınız Soyadınız"
                    value={ad}
                    onChange={(e) => setAd(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="form-alan">
              <label>E-posta</label>
              <div className="ikonlu-giris">
                <Mail size={16} />
                <input
                  type="email"
                  placeholder="ornek@sirket.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus={!ilkKurulum}
                />
              </div>
            </div>

            <div className="form-alan">
              <label>Şifre</label>
              <div className="ikonlu-giris">
                <Lock size={16} />
                <input
                  type={sifreGorunur ? "text" : "password"}
                  placeholder="••••••••"
                  value={sifre}
                  onChange={(e) => setSifre(e.target.value)}
                  required
                  minLength={ilkKurulum ? 6 : undefined}
                />
                <button
                  type="button"
                  className="sifre-goster"
                  onClick={() => setSifreGorunur(!sifreGorunur)}
                  title={sifreGorunur ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {sifreGorunur ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {ilkKurulum && (
              <div className="form-alan">
                <label>Şifre (Tekrar)</label>
                <div className="ikonlu-giris">
                  <Lock size={16} />
                  <input
                    type={sifreGorunur ? "text" : "password"}
                    placeholder="••••••••"
                    value={sifreTekrar}
                    onChange={(e) => setSifreTekrar(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <button type="submit" disabled={gonderiliyor}>
              {gonderiliyor
                ? ilkKurulum
                  ? "Oluşturuluyor..."
                  : "Giriş yapılıyor..."
                : ilkKurulum
                  ? "Hesabı Oluştur"
                  : "Giriş Yap"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Giris;
