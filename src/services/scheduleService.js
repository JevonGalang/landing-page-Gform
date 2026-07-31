import API from "./api";

/**
 * Buat jadwal kuliah baru (Admin).
 * POST /post/formadmin
 *
 * @param {object} data
 * @param {number} data.labId - ID laboratorium
 * @param {string} data.prodi
 * @param {string} data.matkul
 * @param {string} data.dosen
 * @param {string} data.tanggal - format YYYY-MM-DD
 * @param {string} data.jamMulai - format HH:MM
 * @param {string} data.jamSelesai - format HH:MM
 * @returns {Promise<{ success: boolean, message?: string, data?: any }>}
 */
export const createSchedule = async (data) => {
  try {
    const payload = {
      labnya: parseInt(data.labId, 10),
      prodinya: data.prodi,
      matkulnya: data.matkul,
      dosennya: data.dosen,
      tanggalnya: data.tanggal,
      jammulainya: data.jamMulai,
      jamselesainya: data.jamSelesai,
      source: data.source || "manual",
      sourcenya: data.source || "manual",
      is_auto: data.is_auto ?? false,
    };
    const response = await API.post("/post/formadmin", payload);
    return { success: true, data: response.data };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal membuat jadwal. Silakan coba lagi.";
    return { success: false, message };
  }
};

/**
 * Ambil semua jadwal kuliah.
 *
 * @param {boolean} isPublic - Jika true, gunakan endpoint public /get/public/jadwal. Jika false, gunakan /get/penggunaanlab.
 * @returns {Promise<{ success: boolean, data?: Array, message?: string }>}
 */
export const getAllSchedules = async (isPublic = true) => {
  try {
    const endpoint = isPublic ? "/get/public/jadwal" : "/get/penggunaanlab";
    const response = await API.get(endpoint);
    const data = Array.isArray(response.data)
      ? response.data
      : response.data?.message || response.data?.data || response.data?.results || [];
    return { success: true, data };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Gagal memuat data jadwal. Silakan coba lagi.";
    return { success: false, message };
  }
};

/**
 * Ambil semua jadwal kuliah (Admin - terproteksi).
 * GET /get/jadwal
 *
 * @returns {Promise<{ success: boolean, data?: Array, message?: string }>}
 */
export const getJadwalBackend = async () => {
  try {
    const response = await API.get("/get/jadwal");
    const data = Array.isArray(response.data)
      ? response.data
      : response.data?.message || response.data?.data || response.data?.results || [];
    return { success: true, data };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Gagal memuat data jadwal dari backend.";
    return { success: false, message };
  }
};
