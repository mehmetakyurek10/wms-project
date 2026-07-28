import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Giris from "./pages/Giris";
import Urunler from "./pages/Urunler";
import KorumaliRota from "./components/KorumaliRota";
import Kategoriler from "./pages/Kategoriler";
import Tedarikciler from "./pages/Tedarikciler";
import StokHareketleri from "./pages/StokHareketleri";
import SatinalmaSiparisleri from "./pages/SatinalmaSiparisleri";
import Panel from "./pages/Panel";
import { ToastSaglayici } from "./context/ToastContext";

function App() {
  useEffect(() => {
    const kayitliTema = localStorage.getItem("tema") || "dark";
    document.documentElement.setAttribute("data-tema", kayitliTema);
  }, []);

  return (
    <ToastSaglayici>
      <BrowserRouter>
        <Routes>
          <Route path="/giris" element={<Giris />} />
          <Route element={<KorumaliRota />}>
            <Route path="/panel" element={<Panel />} />
            <Route path="/urunler" element={<Urunler />} />
            <Route path="/kategoriler" element={<Kategoriler />} />
            <Route path="/tedarikciler" element={<Tedarikciler />} />
            <Route path="/stok-hareketleri" element={<StokHareketleri />} />
            <Route
              path="/satinalma-siparisleri"
              element={<SatinalmaSiparisleri />}
            />
          </Route>
          <Route path="/" element={<Navigate to="/panel" />} />
        </Routes>
      </BrowserRouter>
    </ToastSaglayici>
  );
}

export default App;
