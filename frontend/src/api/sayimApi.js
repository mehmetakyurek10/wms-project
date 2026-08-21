import api from "./axios";

export const sayimKaydet = (data) => api.post("/sayim", data);
export const sayimGecmisi = (params) => api.get("/sayim", { params });
export const sayimDetay = (id) => api.get(`/sayim/${id}`);
