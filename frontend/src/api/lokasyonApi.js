import api from "./axios";

export const lokasyonlariGetir = () => api.get("/lokasyonlar");
export const lokasyonStok = (id) => api.get(`/lokasyonlar/${id}/stok`);
export const lokasyonEkle = (data) => api.post("/lokasyonlar", data);
export const lokasyonGuncelle = (id, data) =>
  api.put(`/lokasyonlar/${id}`, data);
export const lokasyonSil = (id) => api.delete(`/lokasyonlar/${id}`);
