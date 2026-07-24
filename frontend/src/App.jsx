import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Giris from "./pages/Giris";
import Urunler from "./pages/Urunler";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/giris" element={<Giris />} />
        <Route path="/urunler" element={<Urunler />} />
        <Route path="/" element={<Navigate to="/urunler" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
