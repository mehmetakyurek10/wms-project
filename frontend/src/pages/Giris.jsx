import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Warehouse, Mail, Lock, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { girisYap } from "../api/authApi";
import useAuth from "../hooks/useAuth";

function Giris() {
  const navigate = useNavigate();
  const { kullanici, hazir, oturumAc } = useAuth();
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [sifreGorunur, setSifreGorunur] = useState(false);
  const [hata, setHata] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [tema, setTema] = useState(
    () => document.documentElement.getAttribute("data-tema") || "dark",
  );

  // Mesaj render sirasinda turetiliyor, effect icinde setState ile degil.
  // Bayragin silinmesi asagidaki effect'te; boylece StrictMode ikinci kez
  // calistirsa da mesaj kaybolmuyor.
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
    setGonderiliyor(true);
    try {
      const response = await girisYap(email, sifre);
      oturumAc(response.data);
      navigate("/panel");
    } catch (err) {
      setHata(err.response?.data?.hata || "Giriş başarısız");
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

        <h1>Depo Yönetim Sistemi</h1>
        <p className="giris-alt-baslik">Devam etmek için giriş yapın</p>

        {bilgi && <p className="bilgi-metni">{bilgi}</p>}
        {hata && <p className="hata-kutusu">{hata}</p>}

        <form onSubmit={handleSubmit} className="giris-form">
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
                autoFocus
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

          <button type="submit" disabled={gonderiliyor}>
            {gonderiliyor ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Giris;
