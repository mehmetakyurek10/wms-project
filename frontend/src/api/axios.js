import axios from "axios";
import { getAccessToken, setAccessToken, clearAccessToken } from "./tokenStore";

const baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  throw new Error(
    "VITE_API_URL tanımlı değil. frontend/.env dosyasını .env.example'a bakarak oluşturun.",
  );
}

const api = axios.create({ baseURL, withCredentials: true });

let yenilemeIstegi = null;

// Yenileme cagrisi bilerek "api" ornegini kullanmiyor: kullansaydi bu
// cagrinin kendi 401'i asagidaki interceptor'a duser ve sonsuz donguye
// girerdi.
//
// Tek ucus (single flight): es zamanli 401 alan birden fazla istek tek bir
// yenilemeyi paylasir. Bu onemli, cunku sunucuda rotation acik; her cagri
// ayri ayri yenileseydi cerez ust uste degisir ve yaris cikardi.
export function accessTokenYenile() {
  if (!yenilemeIstegi) {
    yenilemeIstegi = axios
      .post(`${baseURL}/auth/yenile`, null, { withCredentials: true })
      .then((cevap) => {
        setAccessToken(cevap.data.token);
        return cevap.data;
      })
      .finally(() => {
        yenilemeIstegi = null;
      });
  }
  return yenilemeIstegi;
}

function oturumuBitir() {
  clearAccessToken();
  sessionStorage.setItem("oturumBitti", "1");
  window.dispatchEvent(new Event("wms:oturum-bitti"));
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const istek = error.config;

    if (error.response?.status !== 401 || !istek || istek._yenilendi) {
      return Promise.reject(error);
    }

    // /auth/* uclarindan gelen 401 yenilemeyle cozulmez: ya giris bilgisi
    // hatalidir, ya yenileme reddedilmistir, ya da cikis yapilmistir.
    if (istek.url && istek.url.startsWith("/auth/")) {
      return Promise.reject(error);
    }

    istek._yenilendi = true;

    try {
      await accessTokenYenile();
    } catch {
      oturumuBitir();
      return Promise.reject(error);
    }

    return api(istek);
  },
);

export default api;
