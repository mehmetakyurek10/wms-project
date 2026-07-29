import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Warehouse,
  LayoutDashboard,
  Package,
  Boxes,
  ArrowLeftRight,
  Truck,
  ShoppingCart,
  Tags,
  Users,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const ROL_ADLARI = {
  admin: "Yönetici",
  depo_sorumlusu: "Depo Sorumlusu",
};

function Sidebar() {
  const navigate = useNavigate();
  const kullanici = JSON.parse(localStorage.getItem("kullanici") || "null");
  const [acik, setAcik] = useState(false);
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

  const gruplar = [
    {
      baslik: null,
      linkler: [{ to: "/panel", ikon: LayoutDashboard, ad: "Panel" }],
    },
    {
      baslik: "Stok",
      linkler: [
        { to: "/urunler", ikon: Package, ad: "Ürünler" },
        { to: "/varyantlar", ikon: Boxes, ad: "Stok Kalemleri" },
        { to: "/stok-hareketleri", ikon: ArrowLeftRight, ad: "Hareketler" },
      ],
    },
    {
      baslik: "Satınalma",
      linkler: [
        { to: "/tedarikciler", ikon: Truck, ad: "Tedarikçiler" },
        { to: "/satinalma-siparisleri", ikon: ShoppingCart, ad: "Siparişler" },
      ],
    },
    {
      baslik: "Tanımlar",
      linkler: [
        { to: "/kategoriler", ikon: Tags, ad: "Kategoriler" },
        ...(kullanici?.rol === "admin"
          ? [{ to: "/kullanicilar", ikon: Users, ad: "Kullanıcılar" }]
          : []),
      ],
    },
  ];

  const basHarfler = kullanici?.ad
    ? kullanici.ad
        .split(" ")
        .map((kelime) => kelime[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <>
      <button className="menu-btn" onClick={() => setAcik(!acik)} title="Menü">
        {acik ? <X size={18} /> : <Menu size={18} />}
      </button>

      {acik && <div className="menu-perde" onClick={() => setAcik(false)} />}

      <aside className={`yan-menu ${acik ? "acik" : ""}`}>
        <div className="yan-marka">
          <Warehouse size={20} />
          <span>WMS</span>
        </div>

        <nav className="yan-linkler">
          {gruplar.map((grup, i) => (
            <div className="yan-grup" key={i}>
              {grup.baslik && (
                <div className="yan-grup-baslik">{grup.baslik}</div>
              )}
              {grup.linkler.map((link) => {
                const Ikon = link.ikon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setAcik(false)}
                  >
                    <Ikon size={16} />
                    {link.ad}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="yan-alt">
          {kullanici && (
            <div
              className="yan-kullanici"
              title={`${kullanici.ad} · ${ROL_ADLARI[kullanici.rol] || kullanici.rol}`}
            >
              <span className="avatar">{basHarfler}</span>
              <div className="yan-kullanici-bilgi">
                <span className="yan-kullanici-ad">{kullanici.ad}</span>
                <span className="yan-kullanici-rol">
                  {ROL_ADLARI[kullanici.rol] || kullanici.rol}
                </span>
              </div>
            </div>
          )}
          <div className="yan-aksiyon">
            <button
              className="ikincil ikon-btn"
              onClick={temaDegistir}
              title="Tema"
            >
              {tema === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              className="tehlike ikon-btn"
              onClick={cikisYap}
              title="Çıkış"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
