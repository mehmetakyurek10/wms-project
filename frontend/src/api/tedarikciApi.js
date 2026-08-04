import api from "./axios";

export const tedarikcileriGetir = (params) =>
  api.get("/tedarikciler", { params });
export const tedarikciEkle = (data) => api.post("/tedarikciler", data);
export const tedarikciGuncelle = (id, data) =>
  api.put(`/tedarikciler/${id}`, data);
export const tedarikciSil = (id) => api.delete(`/tedarikciler/${id}`);
