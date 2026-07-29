import { Navigate, Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

function KorumaliRota() {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/giris" />;
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
