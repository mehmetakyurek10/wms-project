import api from "./axios";

export const sayimKaydet = (data) => api.post("/sayim", data);
