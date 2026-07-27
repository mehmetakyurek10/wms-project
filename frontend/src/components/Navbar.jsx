import { NavLink, useNavigate } from "react-router-dom";
import {
  Warehouse,
  Package,
  Tags,
  Truck,
  ArrowLeftRight,
  ShoppingCart,
  LayoutDashboard,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { useState } from "react";

function Navbar() {
  const navigate = useNavigate();
  const kullanici = JSON.parse(localStorage.getItem("kullanici") || "null");
  const [tema, setTema] = useState(
    () => document.documentElement.getAttribute("data-tema") || "dark",
  );

  const cikisYap = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("kullanici");
    navigate("/giris");
  };

  const temaDegistir = () => {
    const yeni = tema === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-tema", yeni);
    localStorage.setItem("tema", yeni);
    setTema(yeni);
  };

  return (
    <nav className="navbar">
      <div className="navbar-sol">
        <span className="navbar-marka">
          <Warehouse size={18} />
          WMS
        </span>
        <div className="navbar-linkler">
          <NavLink to="/panel">
            <LayoutDashboard size={15} />
            Panel
          </NavLink>
          <NavLink to="/urunler">
            <Package size={15} />
            Ürünler
          </NavLink>
          <NavLink to="/kategoriler">
            <Tags size={15} />
            Kategoriler
          </NavLink>
          <NavLink to="/tedarikciler">
            <Truck size={15} />
            Tedarikçiler
          </NavLink>
          <NavLink to="/stok-hareketleri">
            <ArrowLeftRight size={15} />
            Hareketler
          </NavLink>
          <NavLink to="/satinalma-siparisleri">
            <ShoppingCart size={15} />
            Satınalma
          </NavLink>
        </div>
      </div>

      <div className="navbar-kullanici">
        {kullanici && (
          <span className="navbar-rozet">
            {kullanici.ad} · {kullanici.rol}
          </span>
        )}
        <button
          className="navbar-btn ikon-btn"
          onClick={temaDegistir}
          title="Tema değiştir"
        >
          {tema === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          className="navbar-btn tehlike ikon-btn"
          onClick={cikisYap}
          title="Çıkış yap"
        >
          <LogOut size={15} />
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
