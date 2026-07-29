import api from "./axios";

export const gunlukRapor = (params) => api.get("/raporlar/gunluk", { params });
