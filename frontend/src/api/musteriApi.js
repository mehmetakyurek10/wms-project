import api from "./axios";

export const musterileriGetir = (params) => api.get("/musteriler", { params });
export const musteriEkle = (data) => api.post("/musteriler", data);
export const musteriGuncelle = (id, data) => api.put(`/musteriler/${id}`, data);
export const musteriSil = (id) => api.delete(`/musteriler/${id}`);
