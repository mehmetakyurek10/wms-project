import api from "./axios";

export const stokHareketiEkle = (data) => api.post("/stok-hareketleri", data);
export const stokHareketleriniGetir = (params) =>
  api.get("/stok-hareketleri", { params });
