import api from "./axios";

export const urunleriGetir = () => api.get("/urunler");
export const urunEkle = (data) => api.post("/urunler", data);
export const urunGuncelle = (id, data) => api.put(`/urunler/${id}`, data);
export const urunSil = (id) => api.delete(`/urunler/${id}`);
