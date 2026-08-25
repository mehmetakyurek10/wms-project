import api from "./axios";

export const lokasyonlariGetir = (params) =>
  api.get("/lokasyonlar", { params });
export const lokasyonHaritasi = () => api.get("/lokasyonlar/harita");
export const lokasyonStok = (id) => api.get(`/lokasyonlar/${id}/stok`);
export const lokasyonEkle = (data) => api.post("/lokasyonlar", data);
export const lokasyonGuncelle = (id, data) =>
  api.put(`/lokasyonlar/${id}`, data);
export const lokasyonSil = (id) => api.delete(`/lokasyonlar/${id}`);
export const blokOlustur = (data) =>
  api.post("/lokasyonlar/blok-olustur", data);
export const tutarlilikKontrol = () => api.get("/lokasyonlar/tutarlilik");
