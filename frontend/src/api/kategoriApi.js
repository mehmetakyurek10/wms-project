import api from "./axios";

export const kategorileriGetir = () => api.get("/kategoriler");
export const kategoriEkle = (data) => api.post("/kategoriler", data);
