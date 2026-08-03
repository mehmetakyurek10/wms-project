import api from "./axios";

export const changePassword = (data) => api.patch("/hesap/sifre", data);
