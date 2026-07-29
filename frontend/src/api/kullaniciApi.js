import api from "./axios";

export const kullanicilariGetir = () => api.get("/kullanicilar");
export const kullaniciGuncelle = (id, data) =>
  api.patch(`/kullanicilar/${id}`, data);
