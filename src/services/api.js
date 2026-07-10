import axios from "axios";

export const BACKEND_URL = "http://172.20.32.62:3000";

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
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle common errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
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
