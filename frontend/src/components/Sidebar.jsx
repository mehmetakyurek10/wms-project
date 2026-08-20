import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Warehouse,
  LayoutDashboard,
  Package,
  Boxes,
  Layers,
  ArrowLeftRight,
  ClipboardCheck,
  Map as MapIcon,
  MapPin,
  Truck,
  ShoppingCart,
  Store,
  Building2,
  ShoppingBag,
  FileBarChart,
  Tags,
  Users,
  Activity,
  Sun,
  Moon,
  LogOut,
  KeyRound,
  Menu,
  X,
} from "lucide-react";
import useAuth from "../hooks/useAuth";

const ROL_ADLARI = {
  admin: "Yönetici",
  depo_sorumlusu: "Depo Sorumlusu",
};

function menuGruplari(kullanici) {
  const yonetici = kullanici?.rol === "admin";

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
        { to: "/depo-haritasi", ikon: MapIcon, ad: "Depo Haritası" },
        { to: "/paletler", ikon: Layers, ad: "Palet Sorgula" },
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
        { to: "/pazar-seferleri", ikon: Store, ad: "Pazar Seferleri" },
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
        ...(yonetici
          ? [
              { to: "/kullanicilar", ikon: Users, ad: "Kullanıcılar" },
              { to: "/lokasyon-yonetimi", ikon: MapPin, ad: "Lokasyonlar" },
              { to: "/sistem-sagligi", ikon: Activity, ad: "Sistem Sağlığı" },
            ]
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
  const { kullanici, cikis } = useAuth();
  const [acik, setAcik] = useState(false);
  const [cikiliyor, setCikiliyor] = useState(false);
  const [tema, setTema] = useState(
    () => document.documentElement.getAttribute("data-tema") || "dark",
  );

  const gruplar = menuGruplari(kullanici);
  const rolAdi = ROL_ADLARI[kullanici?.rol] || kullanici?.rol;

  const cikisYap = async () => {
    if (cikiliyor) return;
    setCikiliyor(true);
    try {
      await cikis();
      navigate("/giris");
    } finally {
      setCikiliyor(false);
    }
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
              onClick={() => navigate("/sifre-degistir")}
              title="Şifre Değiştir"
              aria-label="Şifre değiştir"
            >
              <KeyRound size={15} />
            </button>
            <button
              className="ikincil ikon-btn"
              onClick={temaDegistir}
              title="Tema"
              aria-label="Tema değiştir"
            >
              {tema === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              className="tehlike ikon-btn"
              onClick={cikisYap}
              disabled={cikiliyor}
              title="Çıkış"
              aria-label="Oturumu kapat"
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
