import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  throw new Error(
    "VITE_API_URL tanımlı değil. frontend/.env dosyasını .env.example'a bakarak oluşturun.",
  );
}

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("kullanici");

      if (!window.location.pathname.startsWith("/giris")) {
        sessionStorage.setItem("oturumBitti", "1");
        window.location.href = "/giris";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
