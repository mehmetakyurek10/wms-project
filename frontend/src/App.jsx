import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import KorumaliRota from "./components/KorumaliRota";
import { ToastSaglayici } from "./context/ToastSaglayici";
import AuthProvider from "./context/AuthProvider";
import HataSiniri from "./components/HataSiniri";

// Sayfalar tembel yukleniyor: her biri kendi paketine ayriliyor ve yalnizca
// acildiginda indiriliyor. En cok kazanci Panel sagliyor, cunku grafik
// kutuphanesi yalnizca orada kullaniliyor.
const Giris = lazy(() => import("./pages/Giris"));
const Panel = lazy(() => import("./pages/Panel"));
const Urunler = lazy(() => import("./pages/Urunler"));
const Varyantlar = lazy(() => import("./pages/Varyantlar"));
const Kategoriler = lazy(() => import("./pages/Kategoriler"));
const Raporlar = lazy(() => import("./pages/Raporlar"));
const Musteriler = lazy(() => import("./pages/Musteriler"));
const SatisSiparisleri = lazy(() => import("./pages/SatisSiparisleri"));
const MarketTrips = lazy(() => import("./pages/MarketTrips"));
const Kullanicilar = lazy(() => import("./pages/Kullaniciler"));
const Sayim = lazy(() => import("./pages/Sayim"));
const LokasyonYonetimi = lazy(() => import("./pages/LokasyonYonetimi"));
const DepoHaritasi = lazy(() => import("./pages/DepoHaritasi"));
const Pallets = lazy(() => import("./pages/Pallets"));
const Tedarikciler = lazy(() => import("./pages/Tedarikciler"));
const StokHareketleri = lazy(() => import("./pages/StokHareketleri"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const SystemHealth = lazy(() => import("./pages/SystemHealth"));
const SatinalmaSiparisleri = lazy(() => import("./pages/SatinalmaSiparisleri"));

function Yukleniyor() {
  return (
    <div className="yukleniyor-kutu">
      <div className="spinner" />
    </div>
  );
}

function App() {
  useEffect(() => {
    const kayitliTema = localStorage.getItem("tema") || "dark";
    document.documentElement.setAttribute("data-tema", kayitliTema);
  }, []);

  return (
    <ToastSaglayici>
      <AuthProvider>
        <BrowserRouter>
          <HataSiniri>
            <Suspense fallback={<Yukleniyor />}>
              <Routes>
                <Route path="/giris" element={<Giris />} />
                <Route element={<KorumaliRota />}>
                  <Route path="/panel" element={<Panel />} />
                  <Route path="/urunler" element={<Urunler />} />
                  <Route path="/varyantlar" element={<Varyantlar />} />
                  <Route path="/kategoriler" element={<Kategoriler />} />
                  <Route path="/raporlar" element={<Raporlar />} />
                  <Route path="/musteriler" element={<Musteriler />} />
                  <Route
                    path="/satis-siparisleri"
                    element={<SatisSiparisleri />}
                  />
                  <Route path="/pazar-seferleri" element={<MarketTrips />} />
                  <Route path="/kullanicilar" element={<Kullanicilar />} />
                  <Route path="/sayim" element={<Sayim />} />
                  <Route
                    path="/lokasyon-yonetimi"
                    element={<LokasyonYonetimi />}
                  />
                  <Route path="/depo-haritasi" element={<DepoHaritasi />} />
                  <Route path="/paletler" element={<Pallets />} />
                  <Route path="/tedarikciler" element={<Tedarikciler />} />
                  <Route
                    path="/stok-hareketleri"
                    element={<StokHareketleri />}
                  />
                  <Route path="/sifre-degistir" element={<ChangePassword />} />
                  <Route path="/sistem-sagligi" element={<SystemHealth />} />
                  <Route
                    path="/satinalma-siparisleri"
                    element={<SatinalmaSiparisleri />}
                  />
                </Route>
                <Route path="/" element={<Navigate to="/panel" />} />
              </Routes>
            </Suspense>
          </HataSiniri>
        </BrowserRouter>
      </AuthProvider>
    </ToastSaglayici>
  );
}

export default App;
