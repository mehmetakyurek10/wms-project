import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { girisYap } from "../api/authApi";

function Giris() {
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setHata("");
    try {
      const response = await girisYap(email, sifre);
      localStorage.setItem("token", response.data.token);
      localStorage.setItem(
        "kullanici",
        JSON.stringify(response.data.kullanici),
      );
      navigate("/urunler");
    } catch (err) {
      setHata(err.response?.data?.hata || "Giriş başarısız");
    }
  };

  return (
    <div>
      <h2>Giriş Yap</h2>
      {hata && <p style={{ color: "red" }}>{hata}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Şifre</label>
          <input
            type="password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            required
          />
        </div>
        <button type="submit">Giriş Yap</button>
      </form>
    </div>
  );
}

export default Giris;
