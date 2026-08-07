import api from "./axios";

export const girisYap = (email, sifre) =>
  api.post("/auth/giris", { email, sifre });
export const kayitOl = (data) => api.post("/auth/kayit", data);
export const cikisYap = () => api.post("/auth/cikis");
