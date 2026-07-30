import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Warehouse,
  LayoutDashboard,
  Package,
  Boxes,
  ArrowLeftRight,
  ClipboardCheck,
  Truck,
  ShoppingCart,
  Building2,
  ShoppingBag,
  FileBarChart,
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

function menuGruplari(kullanici) {
  return [
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
        { to: "/sayim", ikon: ClipboardCheck, ad: "Sayım" },
      ],
    },
    {
      baslik: "Satınalma",
      linkler: [
        { to: "/tedarikciler", ikon: Truck, ad: "Tedarikçiler" },
        {
          to: "/satinalma-siparisleri",
          ikon: ShoppingCart,
          ad: "Alım Siparişleri",
        },
      ],
    },
    {
      baslik: "Satış",
      linkler: [
        { to: "/musteriler", ikon: Building2, ad: "Müşteriler" },
        {
          to: "/satis-siparisleri",
          ikon: ShoppingBag,
          ad: "Satış Siparişleri",
        },
      ],
    },
    {
      baslik: "Raporlama",
      linkler: [{ to: "/raporlar", ikon: FileBarChart, ad: "Raporlar" }],
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
}

function basHarfleriAl(ad) {
  if (!ad) return "";
  return ad
    .split(" ")
    .map((kelime) => kelime[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Sidebar() {
  const navigate = useNavigate();
  const kullanici = JSON.parse(localStorage.getItem("kullanici") || "null");
  const [acik, setAcik] = useState(false);
  const [tema, setTema] = useState(
    () => document.documentElement.getAttribute("data-tema") || "dark",
  );

  const gruplar = menuGruplari(kullanici);
  const rolAdi = ROL_ADLARI[kullanici?.rol] || kullanici?.rol;

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
          {gruplar.map((grup) => (
            <div className="yan-grup" key={grup.baslik || "ana"}>
              {grup.baslik && (
                <div className="yan-grup-baslik">{grup.baslik}</div>
              )}
              {grup.linkler.map(({ to, ikon: Ikon, ad }) => (
                <NavLink key={to} to={to} onClick={() => setAcik(false)}>
                  <Ikon size={16} />
                  {ad}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="yan-alt">
          {kullanici && (
            <div
              className="yan-kullanici"
              title={`${kullanici.ad} · ${rolAdi}`}
            >
              <span className="avatar">{basHarfleriAl(kullanici.ad)}</span>
              <div className="yan-kullanici-bilgi">
                <span className="yan-kullanici-ad">{kullanici.ad}</span>
                <span className="yan-kullanici-rol">{rolAdi}</span>
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
