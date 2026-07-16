import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api",
  headers: { "Content-Type": "application/json" },
});

const requestCache = new Map();
const CACHE_TTL = 15000;

const NO_CACHE_PATHS = [
  "/auth/",
  "/messages/",
  "/notifications/",
  "/dispute-messages/",
  "/admin/audit-logs",
  "/admin/disputes",
];

function cacheKey(config) {
  return `${config.method}:${config.url}${config.params ? JSON.stringify(config.params) : ""}`;
}

function isCacheable(config) {
  if (config.method !== "get" || config.cache === false) return false;
  return !NO_CACHE_PATHS.some((p) => config.url.includes(p));
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (isCacheable(config)) {
    const key = cacheKey(config);
    const cached = requestCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      config.adapter = () =>
        Promise.resolve({
          data: cached.data,
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
    }
  }

  return config;
});

api.interceptors.response.use(
  (res) => {
    const method = res.config?.method;
    if (method && method !== "get") {
      const url = res.config?.url || "";
      if (url.includes("/jobs")) api.invalidateCache("/jobs");
      if (url.includes("/contracts")) api.invalidateCache("/contracts");
      if (url.includes("/users")) api.invalidateCache("/users");
      if (url.includes("/proposals")) api.invalidateCache("/proposals");
      if (url.includes("/admin")) api.invalidateCache("/admin");
    }
    if (isCacheable(res.config) && !res.config.adapter) {
      const key = cacheKey(res.config);
      requestCache.set(key, { data: res.data, ts: Date.now() });
    }
    return res;
  },
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api"}/auth/refresh`,
            { refresh_token: refreshToken },
            { headers: { "Content-Type": "application/json" } }
          );
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user");
          localStorage.removeItem("backup_login");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

api.invalidateCache = (urlPattern) => {
  for (const [key] of requestCache) {
    if (key.includes(urlPattern)) requestCache.delete(key);
  }
};

api.clearCache = () => requestCache.clear();

export default api;
