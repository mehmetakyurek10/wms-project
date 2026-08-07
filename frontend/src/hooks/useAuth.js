import { useContext } from "react";
import { AuthContext } from "../context/authContext";

function useAuth() {
  const deger = useContext(AuthContext);

  if (!deger) {
    throw new Error("useAuth yalnizca AuthProvider icinde kullanilabilir");
  }

  return deger;
}

export default useAuth;
