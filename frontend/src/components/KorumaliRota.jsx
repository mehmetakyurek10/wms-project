import { Navigate, Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import useAuth from "../hooks/useAuth";

function KorumaliRota() {
  const { kullanici, hazir } = useAuth();

  if (!hazir) {
    return <div className="yukleniyor-kutu">Oturum kontrol ediliyor...</div>;
  }

  if (!kullanici) {
    return <Navigate to="/giris" replace />;
  }

  return (
    <div className="uygulama">
      <Sidebar />
      <main className="icerik">
        <div className="icerik-ic">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default KorumaliRota;
