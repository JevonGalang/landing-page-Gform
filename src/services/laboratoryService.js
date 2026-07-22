
import API from "./api";
import { labs as fallbackLabs } from "../data/labs";

/**
 * Fetch daftar laboratorium dari backend.
 * GET /get/lab
 *
 * Response format:
 * {
 *   "message": [
 *     { "id_lab": 1, "nama_lab": "Lab Komputer 1" },
 *     { "id_lab": 2, "nama_lab": "Lab Komputer 2" },
 *     ...
 *   ],
 *   "status": 200,
 *   "token": "none"
 * }
 *
 * Jika fetch gagal, fallback ke data statis di labs.js.
 */
export const getLabs = async () => {
  try {
    const response = await API.get("/get/lab");
    const data = response.data;

    if (data && data.message && Array.isArray(data.message)) {
      return data.message.map((item) => {
        // Cari data fallback untuk field tambahan (description, spek, software, dll.)
        const fallback = fallbackLabs.find(
          (fb) => fb.name.toLowerCase() === item.nama_lab.toLowerCase()
        );

        return {
          id: item.id_lab,
          name: item.nama_lab,
          description: fallback?.description || `Laboratorium ${item.nama_lab}`,
          capacity: fallback?.capacity || item.kapasitas || 36,
          status: fallback?.status || "available",
          prodi: fallback?.prodi || "Umum",
          spek: fallback?.spek || "-",
          software: fallback?.software || "-",
        };
      });
    }

    // Format response tidak sesuai, fallback ke data statis
    console.warn("Format response /get/lab tidak sesuai, menggunakan data statis.");
    return fallbackLabs;
  } catch (error) {
    console.error("Gagal fetch lab dari backend, menggunakan data statis:", error);
    return fallbackLabs;
  }
};

/**
 * Fetch data persentase penggunaan laboratorium dari backend.
 * GET /get/lab/persentase
 */
export const getLabPersentase = async () => {
  try {
    const response = await API.get("/get/lab/persentase");
    const data = response.data;
    if (data && data.message && Array.isArray(data.message)) {
      return { success: true, data: data.message };
    }
    return { success: false, message: "Format response tidak sesuai.", data: [] };
  } catch (error) {
    console.error("Gagal fetch persentase lab:", error);
    const msg =
      error.response?.data?.message ||
      error.response?.data?.massage ||
      error.response?.data?.error ||
      "Gagal memuat persentase lab.";
    return { success: false, message: msg, data: [] };
  }
};
