import api from "./axios";

export const varyantlariGetir = (params) => api.get("/varyantlar", { params });
export const dusukStokGetir = () => api.get("/varyantlar/dusuk-stok");
export const varyantEkle = (data) => api.post("/varyantlar", data);
export const varyantGuncelle = (id, data) => api.put(`/varyantlar/${id}`, data);
export const varyantSil = (id) => api.delete(`/varyantlar/${id}`);
