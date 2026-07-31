import API from "./api";

/**
 * Submit logbook / booking mahasiswa.
 * POST /post/logbook
 *
 * @param {object} data
 * @param {number} data.scheduleId - ID jadwal perkuliahan (schadule.id)
 * @param {string} data.namaKetua - Nama mahasiswa penanggung jawab
 * @param {string} data.nim - NIM mahasiswa
 * @param {string} data.kelas - Kelas mahasiswa
 * @param {number} data.jumlahPeserta - Jumlah mahasiswa hadir
 * @param {string} data.nomorWa - Nomor WhatsApp
 * @returns {Promise<{ success: boolean, message?: string, data?: any }>}
 */
export const submitBooking = async (data, isPublic = true) => {
  try {
    const payload = {
      schadule: parseInt(data.scheduleId, 10),
      namaKetua: data.namaKetua.trim(),
      nim: data.nim.trim(),
      kelas: data.kelas.trim(),
      jumlahPeserta: parseInt(data.jumlahPeserta, 10),
      nomorWa: data.nomorWa.trim(),
    };
    const endpoint = isPublic ? "/post/public/logbook" : "/post/logbook";
    const response = await API.post(endpoint, payload);
    return { success: true, data: response.data };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal mengirim pemesanan. Silakan coba lagi.";
    return { success: false, message };
  }
};

/**
 * Ambil semua data logbook (Protected - butuh JWT).
 * GET /get/logbook
 *
 * @returns {Promise<{ success: boolean, data?: Array, message?: string }>}
 */
export const getAllLogbooks = async () => {
  try {
    const response = await API.get("/get/logbook");
    const data = Array.isArray(response.data)
      ? response.data
      : response.data?.message || response.data?.data || response.data?.results || [];
    return { success: true, data };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Gagal memuat data logbook. Silakan coba lagi.";
    return { success: false, message };
  }
};

/**
 * Update status booking / logbook (Admin).
 * POST /post/status
 *
 * @param {number|string} id - ID logbook
 * @param {'diterima'|'ditolak'} status
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export const updateBookingStatus = async (id, status) => {
  try {
    const payload = {
      id: parseInt(id, 10),
      status,
    };
    await API.post("/post/status", payload);
    return { success: true };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Gagal memperbarui status pemesanan. Silakan coba lagi.";
    return { success: false, message };
  }
};

