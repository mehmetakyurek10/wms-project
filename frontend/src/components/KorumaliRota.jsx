import { Suspense } from "react";
import { Navigate, Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import HataSiniri from "./HataSiniri";
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
          {/* Icteki sinir sayfa hatasini yakaliyor, boylece yan menu
              ekranda kaliyor ve kullanici baska bir sayfaya gecebiliyor. */}
          <HataSiniri>
            <Suspense
              fallback={
                <div className="yukleniyor-kutu">
                  <div className="spinner" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </HataSiniri>
        </div>
      </main>
    </div>
  );
}

export default KorumaliRota;
