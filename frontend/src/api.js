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
  reorder: (ids) => api.put("/api/accounts/order", { ids }),
};

// ----------------------------- cards -----------------------------
export const cardsApi = {
  list: () => api.get("/api/cards"),
  create: (payload) => api.post("/api/cards", payload),
  update: (id, payload) => api.patch(`/api/cards/${id}`, payload),
  remove: (id) => api.delete(`/api/cards/${id}`),
  reorder: (ids) => api.put("/api/cards/order", { ids }),
};

// ----------------------------- categories -----------------------------
export const categoriesApi = {
  list: () => api.get("/api/categories"),
  create: (payload) => api.post("/api/categories", payload),
  update: (id, name) => api.patch(`/api/categories/${id}`, { name }),
  // reassignTo 가 있으면 사용 중인 거래를 해당 카테고리로 이관 후 삭제
  remove: (id, reassignTo) =>
    api.delete(`/api/categories/${id}`, {
      params: reassignTo ? { reassign_to: reassignTo } : {},
    }),
  // 같은 그룹(상위끼리 / 한 부모의 하위끼리) 안에서의 순서를 ids 순서대로 저장
  reorder: (ids) => api.put("/api/categories/order", { ids }),
};

// 카테고리 표시명 헬퍼: "상위 > 하위" 또는 "상위"
export const categoryLabel = (catId, categories) => {
  if (!catId) return "";
  const map = Object.fromEntries(categories.map((c) => [c.id, c]));
  const c = map[catId];
  if (!c) return "";
  if (c.parent_id && map[c.parent_id]) return `${map[c.parent_id].name} > ${c.name}`;
  return c.name;
};

// ----------------------------- transactions -----------------------------
export const transactionsApi = {
  list: (params) => api.get("/api/transactions", { params }),
  summary: (params) => api.get("/api/transactions/summary", { params }),
  // 개요 자동완성용: 기존 입력된 개요 목록 (최근순 distinct)
  summaries: (q) => api.get("/api/transactions/summaries", { params: q ? { q } : {} }),
  create: (payload) => api.post("/api/transactions", payload),
  update: (id, payload) => api.patch(`/api/transactions/${id}`, payload),
  remove: (id) => api.delete(`/api/transactions/${id}`),
};

export default api;
