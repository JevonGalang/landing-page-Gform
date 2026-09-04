import { io } from "socket.io-client";
import { BACKEND_URL } from "./api";

/**
 * Socket.IO Realtime Service
 * 
 * Singleton connection manager untuk koneksi realtime ke backend.
 * Listen events:
 *   - "penggunaanlab:update" → data jadwal/penggunaan lab berubah (array lengkap)
 *   - "logbook:update"       → data logbook berubah (array lengkap, sudah JOIN)
 * 
 * Server: http://172.20.32.91
 * 
 * Pola: Socket mengirim DATA LENGKAP (array) dari database setiap kali ada
 * perubahan. Frontend tinggal replace data di state, TANPA perlu fetch ulang via HTTP.
 */

const SOCKET_URL = BACKEND_URL.replace(/\/api\/?$/, "");

// Event names dari backend
export const SOCKET_EVENTS = {
  PENGGUNAAN_UPDATE: "penggunaanlab:update",
  LOGBOOK_UPDATE: "logbook:update",
};

let socket = null;

/**
 * Membuat koneksi Socket.IO ke server.
 * Jika sudah terkoneksi, tidak akan membuat koneksi baru.
 * 
 * @param {object} options
 * @param {function} options.onConnect    - callback saat berhasil terhubung
 * @param {function} options.onDisconnect - callback saat terputus
 * @param {function} options.onError      - callback saat error
 * @returns {object} socket instance
 */
export const connectSocket = ({ onConnect, onDisconnect, onError } = {}) => {
  // Jika sudah ada koneksi yang aktif, kembalikan langsung
  if (socket?.connected) {
    return socket;
  }

  // Jika ada instance lama yang disconnect, bersihkan dulu
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  // Try to get token from localStorage
  let token = null;
  const authData = localStorage.getItem("matisi_admin_auth");
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      token = parsed?.token;
    } catch (e) {
      // Ignore
    }
  }
  if (!token) {
    token = localStorage.getItem("token") || localStorage.getItem("jwt") || localStorage.getItem("jwt_token");
  }

  socket = io(SOCKET_URL, {
    // Transport strategy: coba websocket dulu, fallback ke polling
    transports: ["websocket", "polling"],
    // Auto reconnect
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    // Timeout
    timeout: 10000,
    auth: {
      token: token || ""
    }
  });

  // Connection lifecycle events
  socket.on("connect", () => {
    console.log("[Socket.IO] ✅ Connected:", socket.id);
    onConnect?.();
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket.IO] ❌ Disconnected:", reason);
    onDisconnect?.(reason);
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket.IO] ⚠️ Connection error:", err.message);
    onError?.(err);
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("[Socket.IO] 🔄 Reconnected after", attemptNumber, "attempts");
    onConnect?.();
  });

  socket.on("reconnect_attempt", (attemptNumber) => {
    console.log("[Socket.IO] 🔄 Reconnecting... attempt", attemptNumber);
  });

  return socket;
};

/**
 * Memutuskan koneksi Socket.IO dan membersihkan semua listeners.
 */
export const disconnectSocket = () => {
  if (socket) {
    console.log("[Socket.IO] 🔌 Disconnecting...");
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

/**
 * Mendapatkan socket instance saat ini.
 * @returns {object|null}
 */
export const getSocket = () => socket;

/**
 * Cek apakah socket sedang terkoneksi.
 * @returns {boolean}
 */
export const isSocketConnected = () => socket?.connected ?? false;

// ────────────────────────────────────────────────
// Event Subscription Helpers
// ────────────────────────────────────────────────

/**
 * Subscribe ke event "penggunaanlab:update".
 * Callback menerima ARRAY LENGKAP data penggunaan lab dari database.
 * @param {function} callback - (data: Array) => void
 */
export const onPenggunaanUpdate = (callback) => {
  if (!socket) return;
  socket.on(SOCKET_EVENTS.PENGGUNAAN_UPDATE, callback);
};

/**
 * Unsubscribe dari event "penggunaanlab:update".
 * @param {function} callback
 */
export const offPenggunaanUpdate = (callback) => {
  if (!socket) return;
  socket.off(SOCKET_EVENTS.PENGGUNAAN_UPDATE, callback);
};

/**
 * Subscribe ke event "logbook:update".
 * Callback menerima ARRAY LENGKAP data logbook dari database (sudah JOIN).
 * @param {function} callback - (data: Array) => void
 */
export const onLogbookUpdate = (callback) => {
  if (!socket) return;
  socket.on(SOCKET_EVENTS.LOGBOOK_UPDATE, callback);
};

/**
 * Unsubscribe dari event "logbook:update".
 * @param {function} callback
 */
export const offLogbookUpdate = (callback) => {
  if (!socket) return;
  socket.off(SOCKET_EVENTS.LOGBOOK_UPDATE, callback);
};
