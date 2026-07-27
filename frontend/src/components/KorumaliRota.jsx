import { Navigate, Outlet } from "react-router-dom";
import Navbar from "./Navbar";

function KorumaliRota() {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/giris" />;
  }

  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

export default KorumaliRota;
