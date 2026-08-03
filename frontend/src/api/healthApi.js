import api from "./axios";

export const getSystemChecks = () => api.get("/sistem/kontroller");
