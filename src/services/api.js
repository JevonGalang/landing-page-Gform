import axios from "axios";

export const BACKEND_URL = "http://172.20.32.91/api";

const API = axios.create({
  baseURL: BACKEND_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — attach auth token if available
API.interceptors.request.use(
  (config) => {
    let token = null;

    // Try to get token from matisi_admin_auth first
    const authData = localStorage.getItem("matisi_admin_auth");
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        token = parsed?.token;
      } catch (e) {
        // Invalid auth data, ignore
      }
    }

    // Fallback to standalone token or jwt keys
    if (!token) {
      token = localStorage.getItem("token") || localStorage.getItem("jwt") || localStorage.getItem("jwt_token");
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Console log for API payload and query debug
    console.log(
      `%c[API Request] %c${config.method?.toUpperCase()} %c${config.url}`,
      "color: #4b8fca; font-weight: bold;",
      "color: #22c55e; font-weight: bold;",
      "color: #334155; font-weight: medium;",
      "\n- Params:", config.params || "none",
      "\n- Payload:", config.data || "none",
      "\n- Headers:", config.headers
    );

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle common errors and log responses
API.interceptors.response.use(
  (response) => {
    console.log(
      `%c[API Response Success] %c${response.config.url}`,
      "color: #22c55e; font-weight: bold;",
      "color: #334155;",
      "\n- Status:", response.status,
      "\n- Response Data:", response.data
    );
    return response;
  },
  (error) => {
    console.error(
      `%c[API Response Error] %c${error.config?.url || "Request failed"}`,
      "color: #ef4444; font-weight: bold;",
      "color: #334155;",
      "\n- Status:", error.response?.status || "Network Error",
      "\n- Error Details:", error.response?.data || error.message
    );
    if (error.response?.status === 401) {
      // Clear invalid auth and tokens
      localStorage.removeItem("matisi_admin_auth");
      localStorage.removeItem("token");
      localStorage.removeItem("jwt");
      localStorage.removeItem("jwt_token");
    }
    return Promise.reject(error);
  }
);

export default API;
