import api from "./axios";

export const panelGrafikleri = () => api.get("/panel/grafikler");
