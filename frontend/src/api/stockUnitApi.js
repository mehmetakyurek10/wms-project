import api from "./axios";

export const getStockUnits = (params) => api.get("/stok-birimleri", { params });

export const findPalletByCode = (kod) =>
  api.get(`/stok-birimleri/kod/${encodeURIComponent(kod)}`);

export const palletize = (data) => api.post("/stok-birimleri/paletle", data);
