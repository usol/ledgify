import axios from "axios";
import { supabase } from "./supabaseClient";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// 모든 요청에 현재 Supabase 세션의 access_token 을 자동 첨부
api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ----------------------------- helpers -----------------------------
export const formatWon = (amount) =>
  "₩" + Number(amount || 0).toLocaleString("ko-KR");

// ----------------------------- auth -----------------------------
export const authApi = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
};

// ----------------------------- users (admin) -----------------------------
export const usersApi = {
  list: () => api.get("/api/users"),
  create: (payload) => api.post("/api/users", payload),
  update: (id, name) => api.patch(`/api/users/${id}`, { name }),
  remove: (id) => api.delete(`/api/users/${id}`),
};

// ----------------------------- accounts -----------------------------
export const accountsApi = {
  list: () => api.get("/api/accounts"),
  create: (payload) => api.post("/api/accounts", payload),
  update: (id, payload) => api.patch(`/api/accounts/${id}`, payload),
  remove: (id) => api.delete(`/api/accounts/${id}`),
};

// ----------------------------- cards -----------------------------
export const cardsApi = {
  list: () => api.get("/api/cards"),
  create: (payload) => api.post("/api/cards", payload),
  update: (id, payload) => api.patch(`/api/cards/${id}`, payload),
  remove: (id) => api.delete(`/api/cards/${id}`),
};

// ----------------------------- transactions -----------------------------
export const transactionsApi = {
  list: (params) => api.get("/api/transactions", { params }),
  summary: (params) => api.get("/api/transactions/summary", { params }),
  create: (payload) => api.post("/api/transactions", payload),
  update: (id, payload) => api.patch(`/api/transactions/${id}`, payload),
  remove: (id) => api.delete(`/api/transactions/${id}`),
};

export default api;
