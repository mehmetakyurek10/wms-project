import api from "./axios";

export const siparisleriGetir = () => api.get("/satinalma-siparisleri");
export const siparisOlustur = (data) =>
  api.post("/satinalma-siparisleri", data);
export const siparisTeslimAl = (id, data) =>
  api.patch(`/satinalma-siparisleri/${id}/teslim-al`, data);
export const siparisDetay = (id) =>
  api.get(`/satinalma-siparisleri/${id}/kalemler`);
