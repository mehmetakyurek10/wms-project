import api from "./axios";

export const tedarikcileriGetir = () => api.get("/tedarikciler");
export const tedarikciEkle = (data) => api.post("/tedarikciler", data);
export const tedarikciGuncelle = (id, data) =>
  api.put(`/tedarikciler/${id}`, data);
export const tedarikciSil = (id) => api.delete(`/tedarikciler/${id}`);
