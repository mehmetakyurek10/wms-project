import api from "./axios";

export const stokHareketleriniGetir = () => api.get("/stok-hareketleri");
export const stokHareketiEkle = (data) => api.post("/stok-hareketleri", data);
