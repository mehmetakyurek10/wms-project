import api from "./axios";

export const transferYap = (data) => api.post("/transferler", data);
