import api from "./axios";

export const transferleriGetir = () => api.get("/transferler");
export const transferYap = (data) => api.post("/transferler", data);
