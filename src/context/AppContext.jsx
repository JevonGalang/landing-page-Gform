/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useCallback, useEffect, useRef } from "react";
import { labs } from "../data/labs";
import { getAllSchedules } from "../services/scheduleService";
import { getAllLogbooks } from "../services/bookingService";
import { getHistorySchedules, getHistoryLogbooks } from "../services/historyService";
import { isAuthenticated, isTokenExpired, getTokenRemainingTime, logoutAdmin } from "../services/authService";
import { getLabs } from "../services/laboratoryService";
import {
  connectSocket,
  disconnectSocket,
  onLogbookUpdate,
  offLogbookUpdate,
  onPenggunaanUpdate,
  offPenggunaanUpdate,
  isSocketConnected as checkSocketConnected,
} from "../services/socketService";

export const AppContext = createContext();

const titleCase = (str) => {
  if (!str) return "";
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const parseDateToISO = (dateStr) => {
  if (!dateStr) return "";
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return dateStr;
};

/**
 * Helper: Map backend jadwal object → frontend schedule object.
 * Ditulis defensif agar tidak crash meski format backend sedikit berbeda.
 */
const mapBackendSchedule = (item) => {
  // Ambil tanggal
  const tanggal = item.tanggal || item.tanggalnya || item.tanggalInput || "";
  const isoTanggal = parseDateToISO(tanggal);

  // Hitung nama hari dari tanggal
  let hari = item.hari || "";
  if (!hari && isoTanggal) {
    const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const d = new Date(isoTanggal);
    if (!isNaN(d.getTime())) {
      hari = daysIndo[d.getDay()];
    }
  }

  // Ambil jam mulai & selesai
  const jamMulai = item.jam_mulai || item.jammulai || item.jammulainya || "";
  const jamSelesai = item.jam_selesai || item.jamselesai || item.jamselesainya || "";
  const jam = jamMulai && jamSelesai ? `${jamMulai} - ${jamSelesai}` : item.jam || "-";

  // Ambil nama lab dari relasi atau fallback
  let ruang = "Lab Umum";
  const rawRuang = item.nama_lab || item.namaLab || "";
  if (rawRuang) {
    const matchedLab = labs.find(l => l.name.toLowerCase() === rawRuang.toLowerCase());
    ruang = matchedLab ? matchedLab.name : titleCase(rawRuang);
  } else if (item.laboratorium) {
    ruang = item.laboratorium.nama || item.laboratorium.name || item.laboratorium.namaLab || "Lab Umum";
  } else if (item.lab) {
    ruang = typeof item.lab === "string" ? item.lab : (item.lab.nama || item.lab.name || "Lab Umum");
  } else if (item.ruang) {
    ruang = item.ruang;
  } else if (item.namalab || item.id_lab) {
    const labId = item.namalab || item.id_lab;
    const matchedLab = labs.find(l => l.id === labId || l.id === parseInt(labId, 10));
    ruang = matchedLab ? matchedLab.name : `Lab ID-${labId}`;
  }

  // Ambil prodi dan kelas
  let prodi = item.prodi || item.prodinya || "";
  let kelas = item.kelas || "";
  if (item.prodi_kelas) {
    if (item.prodi_kelas.includes(" - ")) {
      const parts = item.prodi_kelas.split(" - ");
      prodi = parts[0];
      kelas = parts[1];
    } else if (item.prodi_kelas.includes(" / ")) {
      const parts = item.prodi_kelas.split(" / ");
      prodi = parts[0];
      kelas = parts[1];
    } else {
      prodi = item.prodi_kelas;
      kelas = item.prodi_kelas;
    }
  }
  if (!prodi) prodi = "Umum";
  if (!kelas) kelas = "-";

  let source = item.source || item.sourcenya || "";
  if (!source) {
    const isUmPtkin = prodi === "UM PTKIN" || item.prodinya === "UM PTKIN" || item.matkul === "UM PTKIN" || item.matkulnya === "UM PTKIN" || item.mata_kuliah === "UM PTKIN";
    source = isUmPtkin ? "um_ptkin" : "manual";
  }

  const isUmPtkin = source === "um_ptkin" || prodi === "UM PTKIN";
  const status = isUmPtkin ? "diterima" : "kosong";

  return {
    id: item.id,
    _backendId: item.id,
    _type: "jadwal",
    hari: hari || "Senin",
    jam,
    dosen: item.dosen || item.dosennya || "-",
    prodi,
    kelas,
    matkul: item.matkul || item.matkulnya || item.mata_kuliah || "Mata Kuliah Umum",
    ruang,
    tanggalInput: isoTanggal,
    mahasiswa: "Admin (Penjadwalan)",
    nim: "-",
    numberwa: "-",
    jumlahHadir: 0,
    status,
    source,
  };
};

/**
 * Helper: Check if a schedule's time has passed compared to local current date and time.
 * @param {string} tanggalInput - YYYY-MM-DD format
 * @param {string} jam - HH:MM - HH:MM format
 * @returns {boolean}
 */
const isScheduleFinished = (tanggalInput, jam) => {
  if (!tanggalInput) return false;
  try {
    const [year, month, day] = tanggalInput.split("-").map(Number);
    let endHour = 17;
    let endMinute = 0;
    if (jam && jam.includes("-")) {
      const parts = jam.split("-").map(s => s.trim());
      const endTimeStr = parts[1];
      if (endTimeStr && endTimeStr.includes(":")) {
        const [h, m] = endTimeStr.split(":").map(Number);
        if (!isNaN(h)) endHour = h;
        if (!isNaN(m)) endMinute = m;
      }
    }
    const endDateTime = new Date(year, month - 1, day, endHour, endMinute, 0);
    const now = new Date();
    return now > endDateTime;
  } catch (e) {
    return false;
  }
};

/**
 * Helper: Map backend logbook object → frontend booking object.
 * Melakukan lookup ke schedules list jika field schadule hanya berupa ID angka/string.
 */
const mapBackendLogbook = (item, schedules = []) => {
  // Ambil schedule ID dari data logbook
  const scheduleId = item.schadule || item.schedule || item.schadule_id || item.schedule_id || null;
  const parsedScheduleId = scheduleId ? parseInt(scheduleId, 10) : null;

  // Cari schedule yang cocok dari schedules array
  const matchedSchedule = (schedules && parsedScheduleId)
    ? schedules.find(s => parseInt(s.id, 10) === parsedScheduleId || parseInt(s._backendId, 10) === parsedScheduleId)
    : null;

  // Prioritaskan objek schedule hasil lookup (sudah dimap), atau nested object di item, atau matchedSchedule
  const sched = matchedSchedule || 
                (typeof item.schadule === "object" ? item.schadule : null) || 
                (typeof item.schedule === "object" ? item.schedule : null) || 
                (typeof item.jadwal === "object" ? item.jadwal : null) || 
                {};

  // Tentukan apakah objek schedule sudah dalam format hasil map (punya _type: "jadwal")
  const isAlreadyMapped = sched._type === "jadwal";

  // Ambil tanggal (prioritaskan dari flat item lalu dari sched)
  const tanggal = item.tanggal || item.tanggalnya || item.tanggalInput || 
                  (isAlreadyMapped ? sched.tanggalInput : (sched.tanggal || sched.tanggalnya || ""));
  const isoTanggal = parseDateToISO(tanggal);

  // Hitung nama hari dari tanggal
  let hari = item.hari || (isAlreadyMapped ? sched.hari : (sched.hari || ""));
  if (!hari && isoTanggal) {
    const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const d = new Date(isoTanggal);
    if (!isNaN(d.getTime())) {
      hari = daysIndo[d.getDay()];
    }
  }

  // Jam
  const jamMulai = item.jammulai || item.jammulainya || item.jam_mulai || 
                    (!isAlreadyMapped ? (sched.jam_mulai || sched.jammulai || sched.jamMulai || "") : "");
  const jamSelesai = item.jamselesai || item.jamselesainya || item.jam_selesai || 
                      (!isAlreadyMapped ? (sched.jam_selesai || sched.jamselesai || sched.jamSelesai || "") : "");
  
  let jam = "-";
  if (jamMulai && jamSelesai) {
    jam = `${jamMulai} - ${jamSelesai}`;
  } else {
    jam = item.jam || sched.jam || "-";
  }

  // Nama ruang / lab
  let ruang = "Lab Umum";
  const rawRuang = item.nama_lab || item.namaLab || 
                    (!isAlreadyMapped ? (sched.nama_lab || sched.namaLab || sched.ruang || "") : sched.ruang);
  if (rawRuang) {
    const matchedLab = labs.find(l => l.name.toLowerCase() === rawRuang.toLowerCase());
    ruang = matchedLab ? matchedLab.name : titleCase(rawRuang);
  } else if (!isAlreadyMapped) {
    const labObj = sched.laboratorium || sched.lab || item.laboratorium || item.lab;
    if (labObj) {
      ruang = typeof labObj === "string" ? labObj : (labObj.nama || labObj.name || labObj.namaLab || "Lab Umum");
    } else if (sched.ruang) {
      ruang = sched.ruang;
    }
  }

  // Ambil prodi dan kelas
  let prodi = item.prodi || item.prodinya || "";
  let kelas = item.kelas || "";
  const rawProdiKelas = item.prodi_kelas || sched.prodi_kelas || "";
  if (rawProdiKelas) {
    if (rawProdiKelas.includes(" - ")) {
      const parts = rawProdiKelas.split(" - ");
      prodi = parts[0];
      kelas = parts[1];
    } else if (rawProdiKelas.includes(" / ")) {
      const parts = rawProdiKelas.split(" / ");
      prodi = parts[0];
      kelas = parts[1];
    } else {
      if (!prodi) prodi = rawProdiKelas;
      if (!kelas) kelas = rawProdiKelas;
    }
  }
  if (!prodi) prodi = isAlreadyMapped ? sched.prodi : (sched.prodi || "Umum");
  if (!kelas) kelas = isAlreadyMapped ? sched.kelas : (sched.kelas || "-");

  // Dosen dan Matkul
  const dosen = item.dosen || item.dosennya || 
                (isAlreadyMapped ? sched.dosen : (sched.dosen || sched.dosennya || "-"));
  const matkul = item.matkul || item.matkulnya || item.mata_kuliah || 
                 (isAlreadyMapped ? sched.matkul : (sched.matkul || sched.matkulnya || sched.mata_kuliah || "Mata Kuliah Umum"));

  return {
    id: item.id,
    _backendId: item.id,
    _scheduleId: parsedScheduleId || (sched.id ? parseInt(sched.id, 10) : null) || (sched._backendId ? parseInt(sched._backendId, 10) : null),
    _type: "logbook",
    hari: hari || "Senin",
    jam,
    dosen,
    prodi,
    kelas,
    matkul,
    ruang,
    tanggalInput: isoTanggal,
    mahasiswa: item.namaMahasiswa || item.nama_mahasiswa || item.namaKetua || item.nama_ketua || item.mahasiswa || "-",
    nim: item.nim || "-",
    numberwa: item.no_wa || item.noWa || item.nomorWa || item.nomor_wa || item.numberwa || "-",
    jumlahHadir: parseInt(item.jumlah_hadir || item.jumlahHadir || item.jumlahPeserta || item.jumlah_peserta || 0, 10),
    status: isScheduleFinished(isoTanggal, jam) ? "selesai" : (item.status || "dipesan"),
  };
};

export const AppProvider = ({ children }) => {
  const [laboratories, setLaboratories] = useState(labs);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Admin authentication state for Riwayat Penggunaan access
  // Read from localStorage so login persists across browser refreshes
  const [isAdminAuthenticated, setAdminAuthenticated] = useState(() => isAuthenticated());

  // Token expiration state — triggers popup + redirect when JWT expires
  const [tokenExpired, setTokenExpired] = useState(false);
  const tokenTimerRef = useRef(null);

  /**
   * Called when admin acknowledges the token expired popup.
   * Clears auth state and resets tokenExpired flag.
   */
  const handleTokenExpired = useCallback(() => {
    logoutAdmin();
    setAdminAuthenticated(false);
    setTokenExpired(false);
  }, []);

  // Token expiration checker — runs every 30 seconds while admin is authenticated
  useEffect(() => {
    if (!isAdminAuthenticated) {
      // Clear timer when not authenticated
      if (tokenTimerRef.current) {
        clearInterval(tokenTimerRef.current);
        tokenTimerRef.current = null;
      }
      return;
    }

    // Check immediately on mount/login
    if (isTokenExpired()) {
      setTokenExpired(true);
      return;
    }

    // Set up interval to check every 30 seconds
    tokenTimerRef.current = setInterval(() => {
      if (isTokenExpired()) {
        setTokenExpired(true);
        clearInterval(tokenTimerRef.current);
        tokenTimerRef.current = null;
      }
    }, 30000); // Check every 30 seconds

    return () => {
      if (tokenTimerRef.current) {
        clearInterval(tokenTimerRef.current);
        tokenTimerRef.current = null;
      }
    };
  }, [isAdminAuthenticated]);

  // Selected laboratory from card click (TUGAS 2)
  const [selectedLaboratory, setSelectedLaboratory] = useState(null);

  // Notifications for students (when admin approves/rejects their booking)
  const [notifications, setNotifications] = useState([]);

  // Add a notification
  const addNotification = (notification) => {
    setNotifications(prev => [
      {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        isRead: false,
        ...notification
      },
      ...prev
    ]);
  };

  // Mark notification as read
  const markNotificationRead = (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };

  // Mark all notifications as read
  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  // User logbook schedules / bookings — start empty, filled from backend
  const [mySchedules, setMySchedules] = useState([]);
  
  // History schedules / bookings — start empty, filled from backend history endpoints
  const [myHistorySchedules, setMyHistorySchedules] = useState([]);

  // Loading state for data fetching
  const [isDataLoading, setIsDataLoading] = useState(false);

  // ────────────────────────────────────────────────
  // Refs untuk menyimpan raw data terakhir dari backend
  // Digunakan agar saat satu event socket masuk (misal logbook saja),
  // kita masih punya data schedules terakhir untuk merge.
  // ────────────────────────────────────────────────
  const rawSchedulesRef = useRef([]);
  const rawLogbooksRef = useRef([]);

  /**
   * Gabungkan (merge) data schedules + logbooks menjadi mySchedules.
   * Logbook entries menimpa jadwal yang sudah di-booking.
   * Jadwal yang sudah punya logbook aktif → tampilkan versi logbook-nya.
   * 
   * @param {Array} rawSchedules - Array data jadwal mentah dari backend
   * @param {Array} rawLogbooks  - Array data logbook mentah dari backend (sudah JOIN)
   */
  const mergeAndUpdateSchedules = useCallback((rawSchedules, rawLogbooks) => {
    const schedules = rawSchedules.map(mapBackendSchedule);
    const logbooks = rawLogbooks.map(item => mapBackendLogbook(item, schedules));

    // Gabungkan: logbook entries menimpa jadwal yang sudah di-booking.
    // Logbook yang ditolak (status = "ditolak") tidak memblokir jadwal, sehingga jadwal tersebut bisa dipesan kembali.
    const bookedScheduleIds = new Set(
      logbooks
        .filter(lb => lb.status !== "ditolak" && !isScheduleFinished(lb.tanggalInput, lb.jam))
        .map(lb => lb._scheduleId)
        .filter(lbId => lbId !== null && lbId !== undefined)
    );
    const unbookedSchedules = schedules.filter(
      s => !bookedScheduleIds.has(s._backendId) && !bookedScheduleIds.has(s.id)
    );

    setMySchedules([...logbooks, ...unbookedSchedules]);
  }, []);

  /**
   * Gabungkan (merge) data history schedules + logbooks menjadi myHistorySchedules.
   */
  const mergeAndUpdateHistorySchedules = useCallback((rawHistSchedules, rawHistLogbooks) => {
    const schedules = rawHistSchedules.map(mapBackendSchedule);
    const logbooks = rawHistLogbooks.map(item => mapBackendLogbook(item, schedules));

    // Gabungkan untuk history: logbook entries menimpa jadwal yang sudah di-booking
    const bookedScheduleIds = new Set(
      logbooks
        .filter(lb => lb.status !== "ditolak" && !isScheduleFinished(lb.tanggalInput, lb.jam))
        .map(lb => lb._scheduleId)
        .filter(lbId => lbId !== null && lbId !== undefined)
    );
    const unbookedSchedules = schedules.filter(
      s => !bookedScheduleIds.has(s._backendId) && !bookedScheduleIds.has(s.id)
    );

    setMyHistorySchedules([...logbooks, ...unbookedSchedules]);
  }, []);

  /**
   * Fetch jadwal + logbook dari backend via HTTP dan gabungkan ke mySchedules.
   * Juga fetch data riwayat (history) jadwal + logbook dan gabungkan ke myHistorySchedules.
   * Dipanggil saat initial load dan setelah operasi CRUD lokal.
   * Juga menyimpan raw data ke refs untuk digunakan oleh socket handlers.
   */
  const refreshData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const [schedRes, logRes, histSchedRes, histLogRes] = await Promise.all([
        getAllSchedules(),
        getAllLogbooks(),
        getHistorySchedules(),
        getHistoryLogbooks(),
      ]);

      const rawSchedules = schedRes.success
        ? (Array.isArray(schedRes.data) ? schedRes.data : [])
        : [];
      const rawLogbooks = logRes.success
        ? (Array.isArray(logRes.data) ? logRes.data : [])
        : [];

      const rawHistSchedules = histSchedRes.success
        ? (Array.isArray(histSchedRes.data) ? histSchedRes.data : [])
        : [];
      const rawHistLogbooks = histLogRes.success
        ? (Array.isArray(histLogRes.data) ? histLogRes.data : [])
        : [];

      // Simpan ke refs
      rawSchedulesRef.current = rawSchedules;
      rawLogbooksRef.current = rawLogbooks;

      // Map dan merge data aktif
      mergeAndUpdateSchedules(rawSchedules, rawLogbooks);
      
      // Map dan merge data history
      mergeAndUpdateHistorySchedules(rawHistSchedules, rawHistLogbooks);
    } catch (err) {
      console.error("Gagal mengambil data dari server:", err);
    } finally {
      setIsDataLoading(false);
    }
  }, [mergeAndUpdateSchedules, mergeAndUpdateHistorySchedules]);

  // Fetch daftar laboratorium dari backend on mount
  useEffect(() => {
    const fetchLaboratories = async () => {
      try {
        const fetchedLabs = await getLabs();
        if (fetchedLabs && fetchedLabs.length > 0) {
          setLaboratories(fetchedLabs);
        }
      } catch (error) {
        console.error("Gagal fetch daftar lab:", error);
      }
    };
    fetchLaboratories();
  }, []);

  // Fetch initial data on mount (sehingga data langsung terisi di sisi mahasiswa dan admin)
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ────────────────────────────────────────────────
  // Socket.IO Realtime Connection
  // ────────────────────────────────────────────────
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    /**
     * Handler event "penggunaanlab:update"
     * Server mengirim ARRAY LENGKAP data penggunaan lab dari database.
     * Langsung update tanpa fetch ulang via HTTP.
     */
    const handlePenggunaanUpdate = (data) => {
      console.log("[Socket.IO] 📥 penggunaanlab:update diterima —", Array.isArray(data) ? data.length + " items" : data);
      const rawSchedules = Array.isArray(data) ? data : [];
      rawSchedulesRef.current = rawSchedules;
      mergeAndUpdateSchedules(rawSchedules, rawLogbooksRef.current);
    };

    /**
     * Handler event "logbook:update"
     * Server mengirim ARRAY LENGKAP data logbook dari database (sudah JOIN).
     * Langsung update tanpa fetch ulang via HTTP.
     */
    const handleLogbookUpdate = (data) => {
      console.log("[Socket.IO] 📥 logbook:update diterima —", Array.isArray(data) ? data.length + " items" : data);
      const rawLogbooks = Array.isArray(data) ? data : [];
      rawLogbooksRef.current = rawLogbooks;
      mergeAndUpdateSchedules(rawSchedulesRef.current, rawLogbooks);
    };

    // Buat koneksi socket
    connectSocket({
      onConnect: () => setSocketConnected(true),
      onDisconnect: () => setSocketConnected(false),
      onError: () => setSocketConnected(false),
    });

    // Subscribe ke events
    onPenggunaanUpdate(handlePenggunaanUpdate);
    onLogbookUpdate(handleLogbookUpdate);

    // Cek status awal
    setSocketConnected(checkSocketConnected());

    // Cleanup saat unmount
    return () => {
      offPenggunaanUpdate(handlePenggunaanUpdate);
      offLogbookUpdate(handleLogbookUpdate);
      disconnectSocket();
      setSocketConnected(false);
    };
  }, [mergeAndUpdateSchedules]);

  return (
    <AppContext.Provider
      value={{
        laboratories,
        setLaboratories,
        isSidebarOpen,
        setSidebarOpen,
        selectedLaboratory,
        setSelectedLaboratory,
        mySchedules,
        setMySchedules,
        myHistorySchedules,
        setMyHistorySchedules,
        isAdminAuthenticated,
        setAdminAuthenticated,
        tokenExpired,
        handleTokenExpired,
        notifications,
        setNotifications,
        addNotification,
        markNotificationRead,
        markAllNotificationsRead,
        refreshData,
        isDataLoading,
        socketConnected,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
