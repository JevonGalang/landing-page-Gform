import API from "./api";

const AUTH_STORAGE_KEY = "matisi_admin_auth";

/**
 * Login admin via backend API.
 * @param {{ username: string, password: string }} credentials
 * @returns {Promise<{ success: boolean, message?: string, data?: any }>}
 */
export const loginAdmin = async ({ username, password }) => {
  try {
    const response = await API.post("/post/login", { username, password });

    // Extract token from response (prioritizing 'token' as per API response schema)
    const token = response.data?.token || 
                  response.data?.accessToken || 
                  response.data?.jwt || 
                  response.data?.data?.token || 
                  null;

    // Store auth state in localStorage for persistence
    const authData = {
      isAuthenticated: true,
      username,
      token,
      loginTime: new Date().toISOString(),
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));

    // Also store token separately as requested
    if (token) {
      localStorage.setItem("token", token);
      localStorage.setItem("jwt", token);
      localStorage.setItem("jwt_token", token);
    }

    return { success: true, data: response.data };
  } catch (error) {
    // Extract error message, checking both 'message' and potential typo 'massage' from response
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Login gagal. Periksa username dan password Anda.";
    return { success: false, message };
  }
};

// Token expires after 1 hour (in milliseconds)
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Check if the admin token has expired (1 hour after login).
 * @returns {boolean} true if expired or no login data exists
 */
export const isTokenExpired = () => {
  try {
    const authData = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!authData) return true;
    const parsed = JSON.parse(authData);
    if (!parsed.isAuthenticated || !parsed.loginTime) return true;
    const loginTime = new Date(parsed.loginTime).getTime();
    const now = Date.now();
    return (now - loginTime) >= TOKEN_EXPIRY_MS;
  } catch {
    return true;
  }
};

/**
 * Get remaining time before token expires (in milliseconds).
 * @returns {number} ms remaining, or 0 if already expired
 */
export const getTokenRemainingTime = () => {
  try {
    const authData = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!authData) return 0;
    const parsed = JSON.parse(authData);
    if (!parsed.isAuthenticated || !parsed.loginTime) return 0;
    const loginTime = new Date(parsed.loginTime).getTime();
    const elapsed = Date.now() - loginTime;
    const remaining = TOKEN_EXPIRY_MS - elapsed;
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
};

/**
 * Check if admin is currently authenticated.
 * Also checks if the token has expired.
 * @returns {boolean}
 */
export const isAuthenticated = () => {
  try {
    const authData = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!authData) return false;
    const parsed = JSON.parse(authData);
    if (parsed.isAuthenticated !== true) return false;
    // Check token expiration
    if (isTokenExpired()) return false;
    return true;
  } catch {
    return false;
  }
};

/**
 * Get stored auth data.
 * @returns {object|null}
 */
export const getStoredAuth = () => {
  try {
    const authData = localStorage.getItem(AUTH_STORAGE_KEY);
    return authData ? JSON.parse(authData) : null;
  } catch {
    return null;
  }
};

/**
 * Logout admin — clear stored auth.
 */
export const logoutAdmin = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem("token");
  localStorage.removeItem("jwt");
  localStorage.removeItem("jwt_token");
};

/**
 * Ambil informasi RBAC user aktif dari backend.
 * GET /get/rbac/saya
 */
export const getCurrentUserRbac = async () => {
  try {
    const response = await API.get("/get/rbac/saya");
    const data = response.data?.message || response.data?.data || null;
    return { success: true, data };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal memuat informasi akses user.";
    return { success: false, message };
  }
};
