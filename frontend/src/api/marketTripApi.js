import api from "./axios";

export const seferleriGetir = (params) =>
  api.get("/pazar-seferleri", { params });
export const seferKalemleriGetir = (id) =>
  api.get(`/pazar-seferleri/${id}/kalemler`);
export const seferAc = (data) => api.post("/pazar-seferleri", data);
export const seferKapat = (id, data) =>
  api.patch(`/pazar-seferleri/${id}/kapat`, data);
