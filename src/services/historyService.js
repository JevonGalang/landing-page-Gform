import API from "./api";

/**
 * Hapus entri jadwal dan logbook berdasarkan ID.
 * DELETE /delete/:id (Public)
 *
 * @param {string|number} id — ID yang akan dihapus
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export const deleteEntry = async (id) => {
  try {
    await API.delete(`/delete/${id}`);
    return { success: true };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal menghapus data. Silakan coba lagi.";
    return { success: false, message };
  }
};

/**
 * Hapus entri logbook berdasarkan ID (anak saja, parent schedule dipertahankan).
 * DELETE /delete/logbook/:id
 *
 * @param {string|number} id — ID logbook yang akan dihapus
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export const deleteLogbookEntry = async (id) => {
  try {
    await API.delete(`/delete/logbook/${id}`);
    return { success: true };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal menghapus data logbook. Silakan coba lagi.";
    return { success: false, message };
  }
};

/**
 * Hapus semua data logbook.
 * DELETE /delete/logbook/clear
 *
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export const clearAllLogbooks = async () => {
  try {
    await API.delete("/delete/logbook/clear");
    return { success: true };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal menghapus semua data logbook.";
    return { success: false, message };
  }
};

/**
 * Hapus semua data jadwal.
 * DELETE /delete/jadwal/clear
 *
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export const clearAllSchedules = async () => {
  try {
    await API.delete("/delete/jadwal/clear");
    return { success: true };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal menghapus semua data jadwal.";
    return { success: false, message };
  }
};

/**
 * Ambil semua data riwayat logbook dari backend dengan filter opsional.
 * GET /get/history/logbook (Mendukung query params: semester, year, month)
 */
export const getHistoryLogbooks = async (params = {}) => {
  try {
    const response = await API.get("/get/history/logbook", { params });
    const data = Array.isArray(response.data)
      ? response.data
      : response.data?.message || response.data?.data || response.data?.results || [];
    return { success: true, data };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal memuat riwayat logbook.";
    return { success: false, message };
  }
};

/**
 * Ambil semua data riwayat jadwal dari backend dengan filter opsional.
 * GET /get/history/schadule (Mendukung query params: month, year, semester, group_by)
 */
export const getHistorySchedules = async (params = {}) => {
  try {
    const response = await API.get("/get/history/schadule", { params });
    const data = Array.isArray(response.data)
      ? response.data
      : response.data?.message || response.data?.data || response.data?.results || [];
    return { success: true, data };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal memuat riwayat jadwal.";
    return { success: false, message };
  }
};

/**
 * Tambah data logbook ke riwayat backend.
 * POST /post/history/logbook
 */
export const postHistoryLogbook = async (payload) => {
  try {
    const response = await API.post("/post/history/logbook", payload);
    return { success: true, data: response.data };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal menambah riwayat logbook.";
    return { success: false, message };
  }
};

/**
 * Tambah data jadwal ke riwayat backend.
 * POST /post/history/schadule
 */
export const postHistorySchedule = async (payload) => {
  try {
    const response = await API.post("/post/history/schadule", payload);
    return { success: true, data: response.data };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal menambah riwayat jadwal.";
    return { success: false, message };
  }
};

/**
 * Arsip jadwal ke riwayat backend.
 * POST /post/history/archive/:id
 */
export const archiveSchedule = async (id) => {
  try {
    const response = await API.post(`/post/history/archive/${id}`);
    return { success: true, data: response.data };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal mengarsipkan jadwal.";
    return { success: false, message };
  }
};

/**
 * Ambil data perhitungan dinamis jam & persentase penggunaan lab dari backend.
 * GET /get/history/perhitungan
 * @param {object} params — Query parameters: mode, pekan, jam_per_hari, hari_per_pekan, operasional, lab_id, month, year, semester
 */
export const getHistoryPerhitungan = async (params = {}) => {
  try {
    console.log("%c[API Request] GET /get/history/perhitungan", "color: #4b8fca; font-weight: bold;", "\n- Params:", params);
    const response = await API.get("/get/history/perhitungan", { params });
    const data = response.data?.message || response.data?.data || response.data || null;
    console.log("%c[API Response Success] /get/history/perhitungan", "color: #22c55e; font-weight: bold;", "\n- Data Perhitungan:", data);
    return { success: true, data };
  } catch (error) {
    console.error("%c[API Response Error] /get/history/perhitungan", "color: #ef4444; font-weight: bold;", error.response?.data || error.message);
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal memuat data perhitungan dari backend.";
    return { success: false, message };
  }
};

/**
 * Ambil data persentase penggunaan lab dari backend.
 * GET /get/history/persentase
 * @param {object} params — Query parameters: mode, pekan, operasional, lab_id, month, year, semester
 */
export const getHistoryPersentase = async (params = {}) => {
  try {
    console.log("%c[API Request] GET /get/history/persentase", "color: #4b8fca; font-weight: bold;", "\n- Params:", params);
    const response = await API.get("/get/history/persentase", { params });
    const data = response.data?.message || response.data?.data || response.data || null;
    console.log("%c[API Response Success] /get/history/persentase", "color: #22c55e; font-weight: bold;", "\n- Data Persentase:", data);
    return { success: true, data };
  } catch (error) {
    console.error("%c[API Response Error] /get/history/persentase", "color: #ef4444; font-weight: bold;", error.response?.data || error.message);
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal memuat data persentase dari backend.";
    return { success: false, message };
  }
};


