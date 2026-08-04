import api from "./axios";

export const satislariGetir = () => api.get("/satis-siparisleri");
export const satisDetay = (id) => api.get(`/satis-siparisleri/${id}/kalemler`);
export const satisOlustur = (data) => api.post("/satis-siparisleri", data);
export const satisTeslimEt = (id, data) =>
  api.patch(`/satis-siparisleri/${id}/teslim-et`, data);
export const satisIptal = (id) => api.patch(`/satis-siparisleri/${id}/iptal`);
