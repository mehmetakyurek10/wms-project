import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./authContext";
import { accessTokenYenile } from "../api/axios";
import { cikisYap as cikisIstegi } from "../api/authApi";
import { setAccessToken, clearAccessToken } from "../api/tokenStore";

function AuthProvider({ children }) {
  const [kullanici, setKullanici] = useState(null);
  const [hazir, setHazir] = useState(false);

  const oturumAc = useCallback((veri) => {
    setAccessToken(veri.token);
    setKullanici(veri.kullanici);
  }, []);

  const oturumKapat = useCallback(() => {
    clearAccessToken();
    setKullanici(null);
  }, []);

  const cikis = useCallback(async () => {
    try {
      await cikisIstegi();
    } catch {
      // Sunucuya ulasilamasa bile yerel oturum kapatilir.
    }
    oturumKapat();
  }, [oturumKapat]);

  // Access token bellekte durdugu icin sayfa yenilenince kayboluyor.
  // httpOnly cerez tarayicida kaldigindan oturum buradan geri kuruluyor.
  // StrictMode bu effect'i iki kez calistirir; accessTokenYenile tek ucus
  // oldugu icin sunucuya yine tek istek gidiyor.
  useEffect(() => {
    let iptal = false;

    accessTokenYenile()
      .then((veri) => {
        if (iptal) return;
        setKullanici(veri.kullanici);
      })
      .catch(() => {
        if (iptal) return;
        clearAccessToken();
        setKullanici(null);
      })
      .finally(() => {
        if (!iptal) setHazir(true);
      });

    return () => {
      iptal = true;
    };
  }, []);

  useEffect(() => {
    const dinleyici = () => oturumKapat();
    window.addEventListener("wms:oturum-bitti", dinleyici);
    return () => window.removeEventListener("wms:oturum-bitti", dinleyici);
  }, [oturumKapat]);

  return (
    <AuthContext.Provider value={{ kullanici, hazir, oturumAc, cikis }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
