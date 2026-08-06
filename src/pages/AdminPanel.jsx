import { useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import uinLogo from "../assets/logoUIN.jpg";
import { 
  Lock, Eye, EyeOff, LayoutDashboard, FileText, BarChart2, LogOut,
  Search, Filter, Plus, Edit, Trash2, Info, X, Check, Download, Printer, Calendar, Clock, Award,
  Upload, FileSpreadsheet, FileDown, CheckCircle, XCircle, AlertCircle, MessageCircle, History, TrendingUp
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { loginAdmin, logoutAdmin, getCurrentUserRbac } from "../services/authService";
import { createSchedule, getJadwalBackend } from "../services/scheduleService";
import { deleteEntry, deleteLogbookEntry, clearAllLogbooks, clearAllSchedules, getHistoryLogbooks, getHistorySchedules, postHistoryLogbook, postHistorySchedule, archiveSchedule, getHistoryPerhitungan, getHistoryPersentase, getHistoryTerbaru } from "../services/historyService";
import { updateBookingStatus, submitBooking } from "../services/bookingService";
import { getLabPersentase } from "../services/laboratoryService";
import Swal from "sweetalert2"
export default function AdminPanel() {
  const { 
    isAdminAuthenticated, 
    setAdminAuthenticated, 
    mySchedules, 
    setMySchedules,
    myHistorySchedules,
    laboratories,
    addNotification,
    refreshData,
    isDataLoading,
    tokenExpired,
    handleTokenExpired,
    socketConnected
  } = useContext(AppContext);

  const allowedMatisiLabs = [
    "matematika",
    "aplikasi 1",
    "aplikasi 2",
    "aplikasi 3",
    "data sains",
    "jaringan komputer",
    "multimedia 1",
    "multi media 1",
    "multimedia 2",
    "multi media 2",
    "programming",
    "sistem digital",
    "sistem informasi",
    "elc",
    "podcast",
    "sistem operasi",
    "komputasi"
  ];

  const [userProfile, setUserProfile] = useState(null);

  const loadUserProfile = useCallback(async () => {
    try {
      const result = await getCurrentUserRbac();
      if (result.success && result.data) {
        setUserProfile(result.data);
      } else {
        setUserProfile(null);
      }
    } catch (e) {
      console.error("Gagal memuat profil RBAC:", e);
      setUserProfile(null);
    }
  }, []);

  const filteredLaboratories = (laboratories || []).filter(lab => {
    const nameLower = (lab.name || "").toLowerCase();
    
    // Pastikan lab termasuk rumpun MaTiSi
    const isMatisi = allowedMatisiLabs.some(keyword => nameLower.includes(keyword));
    if (!isMatisi) return false;

    // Jika userProfile terisi dan akses_semua_lab false, filter berdasarkan lab yang boleh diakses
    if (userProfile && userProfile.akses_semua_lab === false && Array.isArray(userProfile.labs)) {
      const allowedLabIds = new Set(userProfile.labs.map(l => l.id_lab));
      return allowedLabIds.has(lab.id);
    }
    
    return true;
  });

  const navigate = useNavigate();

  // Auth local states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Tab state: "dashboard", "data-penggunaan", "laporan", "buat-jadwal"
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    if (isAdminAuthenticated) {
      loadUserProfile();
      refreshHistoryData();
    } else {
      setUserProfile(null);
    }
  }, [isAdminAuthenticated, loadUserProfile]);

  // Jadwal Kuliah Form States
  const [inputLab, setInputLab] = useState("");
  const [inputProdi, setInputProdi] = useState("");
  const [inputMatkul, setInputMatkul] = useState("");
  const [inputDosen, setInputDosen] = useState("");
  const [inputTanggal, setInputTanggal] = useState("");
  const [inputJamMulai, setInputJamMulai] = useState("");
  const [inputJamSelesai, setInputJamSelesai] = useState("");
  const [inputKelas, setInputKelas] = useState("");
  const [inputKeterangan, setInputKeterangan] = useState("");

  // UM PTKIN mode states
  const [isUmPtkinMode, setIsUmPtkinMode] = useState(false);
  const [umSupervisors, setUmSupervisors] = useState({
    sesi1: "",
    sesi2: "",
    sesi3: "",
    sesi4: "",
  });

  // Query parameter state for laboratory percentage calculation
  const [persentaseOnlyAuto, setPersentaseOnlyAuto] = useState(true);

  // Helper to check if lab is locked (Podcast, ELC, Riset)
  const isLockedLab = (labName) => {
    if (!labName) return false;
    const nameLower = labName.toLowerCase();
    return nameLower.includes("podcast") || nameLower.includes("elc") || nameLower.includes("riset");
  };

  // Helper to get today's date in local time YYYY-MM-DD
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Mobile sidebar visibility
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // States for Import Excel/CSV
  const getMondayOfCurrentWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, "0");
    const d = String(monday.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const [importedSchedules, setImportedSchedules] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [importError, setImportError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [importWeekStartDate, setImportWeekStartDate] = useState("");
  const [importDefaultLab, setImportDefaultLab] = useState("");

  // Dropdown options
  const listHari = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const listProdi = ["Teknik Informatika", "Sistem Informasi", "Matematika", "Sains Data", "Fisika", "Biologi"];

  // Search, Filter states for Data Penggunaan
  const [searchQuery, setSearchQuery] = useState("");
  const [filterHari, setFilterHari] = useState("");
  const [filterProdi, setFilterProdi] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSource, setFilterSource] = useState("");

  const [selectedLogIds, setSelectedLogIds] = useState([]);

  
  const formatWhatsAppNumber = (num) => {
    if (!num) return "";
    let clean = num.toString().replace(/\D/g, "");
    if (clean.startsWith("0")) {
      clean = "62" + clean.slice(1);
    }
    return clean;
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Laporan Date Range & Type/Status States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportType, setReportType] = useState("semua"); // "semua", "harian", "semester1", "semester2", "bulanan"
  const [reportStatus, setReportStatus] = useState("semua"); // "semua", "terpakai", "tidak terpakai"
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [reportMonth, setReportMonth] = useState("");

  // Detail Modal State
  const [selectedLog, setSelectedLog] = useState(null);

  // Edit Modal State
  const [editingLog, setEditingLog] = useState(null);

  // Laporan Analisis Persentase Lab States
  const [labPercentages, setLabPercentages] = useState([]);
  const [selectedLabId, setSelectedLabId] = useState("");
  const [analisisSemester, setAnalisisSemester] = useState("1");
  const [analisisYear, setAnalisisYear] = useState(new Date().getFullYear().toString());
  const [periodeSemester, setPeriodeSemester] = useState(`Semester 1 / Ganjil (Agt ${new Date().getFullYear()} - Jan ${new Date().getFullYear() + 1})`);

  const getIndonesianDateString = (dateObj = new Date()) => {
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const day = dateObj.getDate();
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const [backendSchedules, setBackendSchedules] = useState([]);
  // States untuk data riwayat backend
  const [historySchedules, setHistorySchedules] = useState([]);
  const [historyLogbooks, setHistoryLogbooks] = useState([]);
  const [historyPerhitunganReguler, setHistoryPerhitunganReguler] = useState(null);
  const [historyPerhitunganUmptkin, setHistoryPerhitunganUmptkin] = useState(null);
  const [historyTerbaruData, setHistoryTerbaruData] = useState(null);

  // Fetch percentages from backend
  const loadLabPercentages = useCallback(async () => {
    try {
      const result = await getLabPersentase(persentaseOnlyAuto);
      if (result.success && result.data && result.data.length > 0) {
        setLabPercentages(result.data);
        if (!selectedLabId) {
          setSelectedLabId(result.data[0].id_lab.toString());
        }
      }
    } catch (e) {
      console.error("Gagal memuat persentase lab:", e);
    }
  }, [selectedLabId, persentaseOnlyAuto]);

  // Fetch schedules from backend
  const loadBackendSchedules = useCallback(async () => {
    try {
      const result = await getJadwalBackend();
      if (result.success && result.data) {
        setBackendSchedules(result.data);
      }
    } catch (e) {
      console.error("Gagal memuat jadwal backend:", e);
    }
  }, []);

  // Fetch riwayat data dari backend dengan dukungan query parameters (semester, year, month)
  const refreshHistoryData = useCallback(async (customParams = {}) => {
    try {
      const [histSchedRes, histLogRes] = await Promise.all([
        getHistorySchedules(customParams),
        getHistoryLogbooks(customParams)
      ]);
      const rawHistSchedules = histSchedRes.success ? histSchedRes.data : [];
      const rawHistLogbooks = histLogRes.success ? histLogRes.data : [];
      setHistorySchedules(rawHistSchedules);
      setHistoryLogbooks(rawHistLogbooks);
    } catch (e) {
      console.error("Gagal memuat data riwayat:", e);
    }
  }, []);

  // Fetch perhitungan dinamis dari backend GET /get/history/perhitungan
  const loadHistoryPerhitungan = useCallback(async (customParams = {}) => {
    try {
      const baseParams = {
        lab_id: selectedLabId,
        semester: analisisSemester,
        year: analisisYear,
        onlyAuto: persentaseOnlyAuto,
        ...customParams,
      };

      // Always fetch reguler calculation
      const resReguler = await getHistoryPerhitungan({ ...baseParams, mode: "reguler" });
      if (resReguler.success && resReguler.data) {
        setHistoryPerhitunganReguler(resReguler.data);
      } else {
        setHistoryPerhitunganReguler(null);
      }

      // If combined mode is active, also fetch UMPTKIN calculation
      if (!persentaseOnlyAuto) {
        const resUmptkin = await getHistoryPerhitungan({ ...baseParams, mode: "umptkin" });
        if (resUmptkin.success && resUmptkin.data) {
          setHistoryPerhitunganUmptkin(resUmptkin.data);
        } else {
          setHistoryPerhitunganUmptkin(null);
        }
      } else {
        setHistoryPerhitunganUmptkin(null);
      }
    } catch (e) {
      console.error("Gagal memuat history perhitungan:", e);
    }
  }, [selectedLabId, analisisSemester, analisisYear, persentaseOnlyAuto]);

  // Fetch riwayat terbaru gabungan dari backend GET /get/history/terbaru
  const loadHistoryTerbaru = useCallback(async (customParams = {}) => {
    try {
      let semesterParam = "s1";
      if (analisisSemester) {
        const lower = String(analisisSemester).toLowerCase();
        if (lower.includes("genap") || lower.includes("2") || lower === "s2") {
          semesterParam = "s2";
        }
      }
      const modeParam = !persentaseOnlyAuto ? "umptkin" : "reguler";
      const params = {
        semester: semesterParam,
        mode: modeParam,
        lab_id: selectedLabId,
        year: analisisYear,
        ...customParams,
      };
      const result = await getHistoryTerbaru(params);
      if (result.success && result.data) {
        setHistoryTerbaruData(result.data);
      }
    } catch (e) {
      console.error("Gagal memuat history terbaru:", e);
    }
  }, [analisisSemester, persentaseOnlyAuto, selectedLabId, analisisYear]);

  // Wrapper untuk refresh seluruh data di admin panel agar selalu sinkron
  const refreshAllAdminData = useCallback(async () => {
    try {
      await refreshData();
      await loadBackendSchedules();
      await loadLabPercentages();
      await refreshHistoryData();
      await loadHistoryTerbaru();
    } catch (e) {
      console.error("Gagal melakukan refresh data admin lengkap:", e);
    }
  }, [refreshData, loadBackendSchedules, loadLabPercentages, refreshHistoryData, loadHistoryTerbaru]);

  useEffect(() => {
    if (isAdminAuthenticated) {
      loadUserProfile();
      loadLabPercentages();
      loadBackendSchedules();
      refreshHistoryData();
    }
  }, [isAdminAuthenticated, loadUserProfile, loadLabPercentages, loadBackendSchedules, refreshHistoryData]);

  // Re-fetch data riwayat ketika filter periode (semester / bulan / tahun) pada tab laporan berubah
  useEffect(() => {
    if (!isAdminAuthenticated) return;
    if (activeTab === "laporan") {
      const params = {};
      if (reportType === "semester1") {
        params.semester = 1;
        if (reportYear) params.year = reportYear;
      } else if (reportType === "semester2") {
        params.semester = 2;
        if (reportYear) params.year = reportYear;
      } else if (reportType === "bulanan" && reportMonth) {
        params.month = reportMonth;
        if (reportYear) params.year = reportYear;
      }
      refreshHistoryData(params);
    } else if (activeTab === "analisis-lab") {
      refreshHistoryData({ semester: analisisSemester, year: analisisYear });
      loadHistoryPerhitungan({ semester: analisisSemester, year: analisisYear, lab_id: selectedLabId });
      loadHistoryTerbaru();
    }
  }, [isAdminAuthenticated, activeTab, reportType, reportYear, reportMonth, analisisSemester, analisisYear, selectedLabId, refreshHistoryData, loadHistoryPerhitungan, loadHistoryTerbaru]);

  // Reset impor states saat tab "buat-jadwal" baru dibuka/di-mount
  useEffect(() => {
    if (activeTab === "buat-jadwal") {
      setImportWeekStartDate("");
      setImportDefaultLab("");
      setImportedSchedules([]);
      setImportFileName("");
      setImportError("");
    }
  }, [activeTab]);

  const getMappedSchedules = useCallback((items) => {
    if (!items || !Array.isArray(items)) return [];
    return items.map((item, idx) => {
      if (!item) return null;
      const jamMulai = item.jam_mulai || item.jammulai || item.jammulainya || "";
      const jamSelesai = item.jam_selesai || item.jamselesai || item.jamselesainya || "";
      const jam = jamMulai && jamSelesai ? `${jamMulai} - ${jamSelesai}` : (item.jam || "-");
      const tanggal = item.tanggal || item.tanggalInput || item.tanggalnya || "";

      return {
        id: item.id || item.id_jadwal || `sched-local-${idx}-${tanggal}`,
        hari: item.hari || "Senin",
        jam,
        jam_mulai: jamMulai,
        jam_selesai: jamSelesai,
        tanggal,
        dosen: item.dosen || item.dosennya || "-",
        prodi: item.prodi || item.prodinya || "Umum",
        kelas: item.kelas || "-",
        matkul: item.matkul || item.matkulnya || item.mata_kuliah || "-",
        id_lab: item.id_lab || item.labnya || item.lab_id || null,
        ruang: item.nama_lab || item.ruang || ""
      };
    }).filter(Boolean);
  }, []);

  const page1Slots = [
    { day: "Senin", time: "07.30 - 10.00", isFirstForDay: true, daySpan: 3 },
    { day: "Senin", time: "10.15 - 12.45", isFirstForDay: false },
    { day: "Senin", time: "13.00 - 15.30", isFirstForDay: false },
    { day: "Selasa", time: "07.30 - 10.00", isFirstForDay: true, daySpan: 3 },
    { day: "Selasa", time: "10.15 - 12.45", isFirstForDay: false },
    { day: "Selasa", time: "13.00 - 16.20", isFirstForDay: false },
    { day: "Rabu", time: "07.30 - 10.00", isFirstForDay: true, daySpan: 3 },
    { day: "Rabu", time: "10.15 - 12.45", isFirstForDay: false },
    { day: "Rabu", time: "13.00 - 15.30", isFirstForDay: false },
    { day: "Kamis", time: "07.30 - 10.00", isFirstForDay: true, daySpan: 1 }
  ];

  const page2Slots = [
    { day: "Kamis", time: "10.15 - 12.45", isFirstForDay: true, daySpan: 2 },
    { day: "Kamis", time: "13.00 - 15.30", isFirstForDay: false },
    { day: "Jumat", time: "07.30 - 10.50", isFirstForDay: true, daySpan: 3 },
    { day: "Jumat", time: "10.15 - 12.45", isFirstForDay: false },
    { day: "Jumat", time: "13.00 - 15.30", isFirstForDay: false }
  ];

  const [editFormData, setEditFormData] = useState({
    hari: "",
    jam: "",
    dosen: "",
    prodi: "",
    kelas: "",
    matkul: "",
    ruang: "",
    tanggalInput: "",
    mahasiswa: "",
    nim: "",
    numberwa: "",
    jumlahHadir: ""
  });

  const BASE_TODAY = new Date().toISOString().split('T')[0]; // tanggal hari ini dinamis

  // Date math utilities
  const isWithinLastDays = (dateStr, days) => {
    const today = new Date(BASE_TODAY);
    const target = new Date(dateStr);
    const diffTime = today - target;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays < days;
  };

  const isThisMonth = (dateStr) => {
    const today = new Date(BASE_TODAY);
    const target = new Date(dateStr);
    return today.getMonth() === target.getMonth() && today.getFullYear() === target.getFullYear();
  };

  // 1. STATS CALCULATIONS
  const totalUsage = mySchedules.length;
  const usageToday = mySchedules.filter(s => s.tanggalInput === BASE_TODAY).length;
  const usageThisWeek = mySchedules.filter(s => isWithinLastDays(s.tanggalInput, 7)).length;
  const usageThisMonth = mySchedules.filter(s => isThisMonth(s.tanggalInput)).length;

  // Recent bookings for Dashboard tab
  const recentUsage = [...mySchedules].slice(0, 5);

  // Handle Login submission via backend API
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await loginAdmin({ username, password });
      if (result.success) {
        setAdminAuthenticated(true);
        setUsername("");
        setPassword("");
        // Fetch data dari backend setelah login berhasil
        await refreshData();
      } else {
        setError(result.message || "Username atau password salah!");
      }
    } catch (err) {
      setError("Gagal menghubungi server. Periksa koneksi Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Add Schedule (Jadwal Kuliah) via backend API
  const handleAddSchedule = async (e) => {
    e.preventDefault();

    if (isUmPtkinMode) {
      if (!inputLab || !inputTanggal) {
        Swal.fire({
          icon: "warning",
          title: "Form Belum Lengkap",
          text: "Laboratorium dan Tanggal Pelaksanaan wajib diisi!",
        });
        return;
      }

      const todayStr = getTodayDateString();
      if (inputTanggal < todayStr) {
        Swal.fire({
          icon: "error",
          title: "Tanggal Tidak Valid",
          text: "Tanggal pelaksanaan tidak boleh sebelum hari ini!",
        });
        return;
      }

      const selectedLabObj = laboratories.find(l => l.name === inputLab);
      const labId = selectedLabObj ? selectedLabObj.id : 1;
      const labCapacity = selectedLabObj?.capacity || 36;

      // Pre-check conflict on inputTanggal for labId before creating any UM PTKIN session
      const existingConflict = (backendSchedules || []).find(s => {
        if (!s) return false;
        const matchesLab = (s.id_lab !== null && s.id_lab !== undefined && parseInt(s.id_lab, 10) === parseInt(labId, 10)) ||
                           (s.ruang && String(s.ruang).toLowerCase() === inputLab.toLowerCase());
        const matchesDate = s.tanggal === inputTanggal || s.tanggalnya === inputTanggal;
        return matchesLab && matchesDate;
      });

      if (existingConflict) {
        console.warn(`[UM PTKIN Aborted] Bentrok dengan jadwal terdaftar pada ${inputTanggal} di ${inputLab}:`, existingConflict);
        Swal.fire({
          icon: "warning",
          title: "Tanggal Sudah Terisi Jadwal",
          text: `Hei Admin! Pada tanggal ${inputTanggal} di ${inputLab} sudah terdapat jadwal terdaftar (${existingConflict.matkul || existingConflict.matkulnya || "Kuliah/Praktikum"}). Harap hapus terlebih dahulu jadwal di tanggal tersebut pada menu Penggunaan Lab jika ingin membuat jadwal UM PTKIN.`,
          confirmButtonColor: "#3b82f6"
        });
        return;
      }

      // Define 4 UM PTKIN sessions (07:30 to 15:30)
      const sessions = [
        { jamMulai: "07:30", jamSelesai: "10:00", dosen: umSupervisors.sesi1 || "Dosen Pengawas Sesi 1" },
        { jamMulai: "10:00", jamSelesai: "12:30", dosen: umSupervisors.sesi2 || "Dosen Pengawas Sesi 2" },
        { jamMulai: "12:30", jamSelesai: "15:00", dosen: umSupervisors.sesi3 || "Dosen Pengawas Sesi 3" },
        { jamMulai: "15:00", jamSelesai: "15:30", dosen: umSupervisors.sesi4 || "Dosen Pengawas Sesi 4" },
      ];

      let successCount = 0;
      let failCount = 0;

      for (const session of sessions) {
        try {
          const result = await createSchedule({
            labId,
            prodi: "UM PTKIN",
            matkul: "UM PTKIN",
            kelas: "UMPTKIN",
            dosen: session.dosen,
            tanggal: inputTanggal,
            jamMulai: session.jamMulai,
            jamSelesai: session.jamSelesai,
            source: "um_ptkin",
            is_auto: false,
          });
          if (result.success) {
            // Ambil ID jadwal yang baru dibuat dari response backend
            const newScheduleId = result.data?.message?.insertId || result.data?.data?.id || result.data?.id || result.data?.insertId || null;
            console.log(`[UM PTKIN] Jadwal sesi ${session.jamMulai}-${session.jamSelesai} dibuat, ID:`, newScheduleId);

            if (newScheduleId) {
              // Auto-submit logbook entry untuk sesi UM PTKIN
              try {
                const bookingResult = await submitBooking({
                  scheduleId: newScheduleId,
                  namaKetua: "Admin UMPTKIN",
                  nim: "000",
                  kelas: "UMPTKIN",
                  jumlahPeserta: labCapacity,
                  nomorWa: "-",
                }, false);
                console.log(`[UM PTKIN] Logbook sesi ${session.jamMulai} dibuat:`, bookingResult);

                if (bookingResult.success) {
                  // Auto-approve logbook (status → diterima)
                  const logbookId = bookingResult.data?.message?.insertId || bookingResult.data?.data?.id || bookingResult.data?.id || bookingResult.data?.insertId || null;
                  if (logbookId) {
                    const approveResult = await updateBookingStatus(logbookId, "diterima");
                    console.log(`[UM PTKIN] Logbook ID ${logbookId} di-approve:`, approveResult);
                  }
                }
              } catch (bookingErr) {
                console.warn(`[UM PTKIN] Gagal auto-submit logbook sesi ${session.jamMulai}:`, bookingErr);
              }
            }
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      if (successCount === sessions.length) {
        await Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: `Semua 4 Sesi Jadwal UM PTKIN (07:30 - 15:30) pada tanggal ${inputTanggal} berhasil dibuat otomatis!`,
        });

        // Reset form states
        setInputLab("");
        setInputProdi("");
        setInputKelas("");
        setInputMatkul("");
        setInputDosen("");
        setInputTanggal("");
        setInputJamMulai("");
        setInputJamSelesai("");
        setInputKeterangan("");
        setIsUmPtkinMode(false);
        setUmSupervisors({ sesi1: "", sesi2: "", sesi3: "", sesi4: "" });

        await refreshAllAdminData();
        setActiveTab("data-penggunaan");
      } else {
        await Swal.fire({
          icon: "error",
          title: "Jadwal UM PTKIN Tidak Lengkap",
          text: `Gagal membuat 4 sesi UM PTKIN secara lengkap (Hanya ${successCount} dari ${sessions.length} sesi yang berhasil). Harap periksa atau hapus data jadwal di tanggal ${inputTanggal} terlebih dahulu!`,
        });
      }
      return;
    }

    let finalProdi = inputProdi;
    let finalMatkul = inputMatkul;

    if (isLockedLab(inputLab)) {
      finalProdi = "Umum";
      finalMatkul = inputKeterangan.trim();
    }

   if (!inputLab || !finalProdi || !inputKelas || !finalMatkul || !inputDosen || !inputTanggal || !inputJamMulai || !inputJamSelesai) {
  Swal.fire({
    icon: "warning",
    title: "Form Belum Lengkap",
    text: "Semua field wajib diisi!",
  });
  return;
}

    const todayStr = getTodayDateString();
    if (inputTanggal < todayStr) {
      Swal.fire({
        icon: "error",
        title: "Tanggal Tidak Valid",
        text: "Tanggal pelaksanaan tidak boleh sebelum hari ini!",
      });
      return;
    }
    // Cari ID lab berdasarkan nama lab yang dipilih
    const selectedLabObj = laboratories.find(l => l.name === inputLab);
    const labId = selectedLabObj ? selectedLabObj.id : 1;

    try {
      // Check for slot time overlap on normal manual creation
      const checkOverlap = (startA, endA, startB, endB) => startA < endB && startB < endA;
      const parseTimeToMin = (t) => {
        if (!t) return 0;
        const [h, m] = String(t).split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      const newStart = parseTimeToMin(inputJamMulai);
      const newEnd = parseTimeToMin(inputJamSelesai);

      const manualConflict = (mySchedules || []).find(s => {
        if (!s) return false;
        const matchesLab = (s.ruang && String(s.ruang).toLowerCase() === inputLab.toLowerCase());
        const matchesDate = s.tanggalInput === inputTanggal;
        if (!matchesLab || !matchesDate) return false;

        let sStart = 0;
        let sEnd = 0;
        if (s.jam && s.jam.includes("-")) {
          const parts = s.jam.split("-").map(p => p.trim());
          sStart = parseTimeToMin(parts[0]);
          sEnd = parseTimeToMin(parts[1]);
        }
        return checkOverlap(newStart, newEnd, sStart, sEnd);
      });

      if (manualConflict) {
        Swal.fire({
          icon: "warning",
          title: "Jam Slot Bentrok",
          text: `Gagal membuat jadwal! Jam ${inputJamMulai} - ${inputJamSelesai} pada tanggal ${inputTanggal} di ${inputLab} sudah terisi oleh ${manualConflict.matkul} (${manualConflict.dosen}).`,
          confirmButtonColor: "#3b82f6"
        });
        return;
      }

      const result = await createSchedule({
        labId,
        prodi: finalProdi,
        matkul: finalMatkul,
        dosen: inputDosen,
        tanggal: inputTanggal,
        jamMulai: inputJamMulai,
        jamSelesai: inputJamSelesai,
        source: "manual",
        is_auto: false,
      });

      if (result.success) {
        await Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: "Jadwal Kuliah berhasil dibuat!",
        });

        // Reset form states
        setInputLab("");
        setInputProdi("");
        setInputKelas("");
        setInputMatkul("");
        setInputDosen("");
        setInputTanggal("");
        setInputJamMulai("");
        setInputJamSelesai("");
        setInputKeterangan("");
        setFilterHari("");
        setFilterProdi("");
        setFilterStatus("");
        setFilterSource("");
        setSearchQuery("");
        setCurrentPage(1);

        // Refresh data dari backend
        await refreshAllAdminData();
        setActiveTab("data-penggunaan");
      } else {
        Swal.fire({
          icon: "error",
          title: "Gagal",
          text: `Gagal membuat jadwal: ${result.message}`,
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Koneksi Bermasalah",
        text: "Gagal menghubungi server. Periksa koneksi Anda.",
      });
    }
  };



  // Handle Logout — clear token dari localStorage
  const handleLogout = async () => {
    const confirmation = await Swal.fire({
      title: "Keluar Sesi Admin?",
      text: "Apakah Anda yakin ingin keluar dari Panel Admin?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Keluar",
      cancelButtonText: "Batal",
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#64748b"
    });

    if (confirmation.isConfirmed) {
      logoutAdmin();
      setAdminAuthenticated(false);
      setMySchedules([]);
      setActiveTab("dashboard");
    }
  };



  // Helper: Format payload schedule ke format request backend biasa (/post/formadmin)
  const formatSchedulePayload = (schedule) => {
    let labId = 1;
    if (schedule.ruang) {
      const matchedLab = laboratories.find(l => l.name.toLowerCase() === schedule.ruang.toLowerCase());
      if (matchedLab) labId = matchedLab.id;
    }
    let jamMulai = "08:00";
    let jamSelesai = "10:00";
    if (schedule.jam && schedule.jam.includes("-")) {
      const parts = schedule.jam.split("-").map(s => s.trim());
      jamMulai = parts[0] || "08:00";
      jamSelesai = parts[1] || "10:00";
    }
    
    const originalId = schedule._type === "logbook" 
      ? schedule._scheduleId 
      : (schedule.id || schedule._backendId);

    return {
      id: originalId ? parseInt(originalId, 10) : null,
      schadule: originalId ? parseInt(originalId, 10) : null,
      labnya: parseInt(labId, 10),
      prodinya: schedule.prodi || "",
      matkulnya: schedule.matkul || "",
      dosennya: schedule.dosen || "",
      tanggalnya: schedule.tanggalInput || "",
      jammulainya: jamMulai,
      jamselesainya: jamSelesai,
      source: schedule.source || "manual",
      sourcenya: schedule.source || "manual",
    };
  };

  // Helper: Format payload logbook ke format request backend biasa (/post/logbook)
  const formatLogbookPayload = (logbook, newHistSchedId = null) => {
    let scheduleId = newHistSchedId || logbook._scheduleId || logbook.scheduleId || logbook.schaduleId;
    
    if (!scheduleId) {
      const rawSched = logbook.schadule || logbook.schedule || logbook.jadwal;
      if (rawSched) {
        if (typeof rawSched === "object") {
          scheduleId = rawSched.id || rawSched._backendId || rawSched.scheduleId || rawSched.schaduleId;
        } else {
          scheduleId = rawSched;
        }
      }
    }
    
    const parsedScheduleId = scheduleId ? parseInt(scheduleId, 10) : null;
    const namaVal = (logbook.mahasiswa || logbook.namaKetua || "").trim();
    const nimVal = (logbook.nim || "").trim();
    const kelasVal = (logbook.kelas || "").trim();
    const jumlahVal = parseInt(logbook.jumlahHadir || logbook.jumlahPeserta || 0, 10);
    const waVal = (logbook.numberwa || logbook.nomorWa || "").trim();
    
    return {
      // ID Schedule Variations
      schadules: parsedScheduleId,
      schadule: parsedScheduleId,
      schedule_id: parsedScheduleId,
      scheduleId: parsedScheduleId,
      
      // namaMahasiswa / namaKetua Variations
      namaKetua: namaVal,
      namaMahasiswa: namaVal,
      
      // nim
      nim: nimVal,
      
      // kelas
      kelas: kelasVal,
      
      // jumlahPeserta / jumlah_hadir Variations
      jumlahPeserta: jumlahVal,
      jumlah_hadir: jumlahVal,
      
      // nomorWa / no_wa Variations
      nomorWa: waVal,
      no_wa: waVal,
    };
  };

  // Helper: Map dan Parsing riwayat data dari backend ke model frontend
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

  const titleCase = (str) => {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const mapHistorySchedule = (item) => {
    const tanggal = item.tanggal || item.tanggalnya || item.tanggalInput || "";
    const isoTanggal = parseDateToISO(tanggal);

    let hari = item.hari || "";
    if (!hari && isoTanggal) {
      const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const d = new Date(isoTanggal);
      if (!isNaN(d.getTime())) {
        hari = daysIndo[d.getDay()];
      }
    }

    const jamMulai = item.jam_mulai || item.jammulai || item.jammulainya || "";
    const jamSelesai = item.jam_selesai || item.jamselesai || item.jamselesainya || "";
    const jam = jamMulai && jamSelesai ? `${jamMulai} - ${jamSelesai}` : item.jam || "-";

    let ruang = "Lab Umum";
    const rawRuang = item.nama_lab || item.namaLab || "";
    if (rawRuang) {
      const matchedLab = laboratories.find(l => l.name.toLowerCase() === rawRuang.toLowerCase());
      ruang = matchedLab ? matchedLab.name : titleCase(rawRuang);
    } else if (item.laboratorium) {
      ruang = item.laboratorium.nama || item.laboratorium.name || "Lab Umum";
    } else if (item.labnya || item.id_lab || item.namalab) {
      const labId = item.labnya || item.id_lab || item.namalab;
      const matchedLab = laboratories.find(l => l.id === parseInt(labId, 10));
      ruang = matchedLab ? matchedLab.name : `Lab ID-${labId}`;
    }

    let prodi = item.prodi || item.prodinya || "";
    let kelas = item.kelas || "";
    if (item.prodi_kelas) {
      if (item.prodi_kelas.includes(" - ")) {
        const parts = item.prodi_kelas.split(" - ");
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
    const isUmPtkin = prodi === "UM PTKIN" || item.prodinya === "UM PTKIN" || item.matkul === "UM PTKIN" || item.matkulnya === "UM PTKIN" || item.mata_kuliah === "UM PTKIN" || source === "um_ptkin";
    
    if (isUmPtkin) {
      source = "um_ptkin";
    } else if (!source) {
      if (item.is_auto === 1 || item.is_auto === true || item.is_auto === "1") {
        source = "import";
      } else {
        source = "manual";
      }
    }

    const isAutoVal = item.is_auto === 1 || item.is_auto === true || item.is_auto === "1" ? 1 : 0;

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
      status: "kosong",
      source,
      is_auto: isAutoVal,
    };
  };

  const mapHistoryLogbook = (item, schedules = []) => {
    const scheduleId = item.schadule || item.schedule || item.schadule_id || item.schedule_id || null;
    const parsedScheduleId = (scheduleId && typeof scheduleId !== "object") ? parseInt(scheduleId, 10) : null;

    const matchedSchedule = (schedules && parsedScheduleId)
      ? schedules.find(s => parseInt(s.id, 10) === parsedScheduleId || parseInt(s._backendId, 10) === parsedScheduleId)
      : null;

    const sched = matchedSchedule || 
                  (typeof item.schadule === "object" ? item.schadule : null) || 
                  (typeof item.schedule === "object" ? item.schedule : null) || 
                  (typeof item.jadwal === "object" ? item.jadwal : null) || 
                  {};

    const isAlreadyMapped = sched._type === "jadwal";
    const tanggal = item.tanggal || item.tanggalnya || item.tanggalInput || 
                    (isAlreadyMapped ? sched.tanggalInput : (sched.tanggal || sched.tanggalnya || ""));
    const isoTanggal = parseDateToISO(tanggal);

    let hari = item.hari || (isAlreadyMapped ? sched.hari : (sched.hari || ""));
    if (!hari && isoTanggal) {
      const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const d = new Date(isoTanggal);
      if (!isNaN(d.getTime())) {
        hari = daysIndo[d.getDay()];
      }
    }

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

    let ruang = "Lab Umum";
    const rawRuang = item.nama_lab || item.namaLab || 
                      (!isAlreadyMapped ? (sched.nama_lab || sched.namaLab || sched.ruang || "") : sched.ruang);
    if (rawRuang) {
      const matchedLab = laboratories.find(l => l.name.toLowerCase() === rawRuang.toLowerCase());
      ruang = matchedLab ? matchedLab.name : titleCase(rawRuang);
    }

    let prodi = item.prodi || item.prodinya || "";
    let kelas = item.kelas || "";
    const rawProdiKelas = item.prodi_kelas || sched.prodi_kelas || "";
    if (rawProdiKelas) {
      if (rawProdiKelas.includes(" - ")) {
        const parts = rawProdiKelas.split(" - ");
        prodi = parts[0];
        kelas = parts[1];
      } else {
        if (!prodi) prodi = rawProdiKelas;
        if (!kelas) kelas = rawProdiKelas;
      }
    }
    if (!prodi) prodi = isAlreadyMapped ? sched.prodi : (sched.prodi || "Umum");
    if (!kelas) kelas = isAlreadyMapped ? sched.kelas : (sched.kelas || "-");

    const dosen = item.dosen || item.dosennya || 
                  (isAlreadyMapped ? sched.dosen : (sched.dosen || sched.dosennya || "-"));
    const matkul = item.matkul || item.matkulnya || item.mata_kuliah || 
                   (isAlreadyMapped ? sched.matkul : (sched.matkul || sched.matkulnya || sched.mata_kuliah || "Mata Kuliah Umum"));

    const isUmPtkin = prodi === "UM PTKIN" || matkul === "UM PTKIN";
    const source = item.source || item.sourcenya || sched.source || (isUmPtkin ? "um_ptkin" : "manual");

    return {
      id: item.id,
      _backendId: item.id,
      _scheduleId: parsedScheduleId || (sched.id ? parseInt(sched.id, 10) : null),
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
      status: "terpakai",
      source
    };
  };

  // Move active logbook/schedule to history and delete from active list
  const handleAddToHistory = async (item) => {
    const confirmation = await Swal.fire({
      title: "Tambahkan ke History?",
      text: "Data ini akan dipindahkan ke riwayat laporan dan dihapus dari daftar aktif.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Pindahkan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#64748b"
    });

    if (!confirmation.isConfirmed) return;

    try {
      if (item._backendId) {
        const scheduleIdToArchive = item._type === "logbook" ? item._scheduleId : item._backendId;
        if (!scheduleIdToArchive) {
          throw new Error("ID Jadwal Induk tidak ditemukan.");
        }
        const archiveResult = await archiveSchedule(scheduleIdToArchive);
        if (!archiveResult.success) {
          throw new Error(archiveResult.message || "Gagal mengarsipkan data di server.");
        }
      } else {
        // Jika offline/lokal saja
        setMySchedules(mySchedules.filter((s) => s.id !== item.id));
      }

      await Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Data berhasil dipindahkan ke riwayat laporan.",
        confirmButtonColor: "#3b82f6"
      });

      await refreshAllAdminData();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Terjadi Kesalahan",
        text: err.message || "Gagal memindahkan data ke riwayat.",
        confirmButtonColor: "#3b82f6"
      });
    }
  };

  // Delete Log via backend API
  const handleDeleteLog = async (id) => {
    const confirmation = await Swal.fire({
      title: "Hapus Data?",
      text: "Data yang dihapus tidak dapat dikembalikan.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
    });

    if (!confirmation.isConfirmed) return;

    const item = mySchedules.find((s) => s.id === id);

    if (item && item._backendId) {
      try {
        const isUmPtkin = item.source === "um_ptkin" || item.prodi === "UM PTKIN";
        let result = null;

        // 1. Simpan ke history (try-catch terisolasi agar tidak menghalangi penghapusan aktif jika history gagal)
        try {
          if (item._type === "logbook" || item.status === "dipesan" || item.status === "diterima" || item.status === "selesai") {
            const schedHistRes = await postHistorySchedule(formatSchedulePayload(item));
            if (schedHistRes && schedHistRes.success) {
              const newHistSchedId = schedHistRes.data?.newHistoryScheduleId || schedHistRes.data?.insertId || schedHistRes.data?.id || schedHistRes.data?.message?.newHistoryScheduleId || schedHistRes.data?.message?.id;
              const logbookPayload = formatLogbookPayload(item, newHistSchedId);
              await postHistoryLogbook(logbookPayload);
            }
          } else {
            await postHistorySchedule(formatSchedulePayload(item));
          }
        } catch (histErr) {
          console.error("Gagal mencatat riwayat ke history (single delete):", histErr);
        }

        // 2. Hapus data aktif dari server (Untuk UM PTKIN, hapus logbook dan juga jadwal induknya)
        if (isUmPtkin) {
          if (item._type === "logbook" && item._backendId) {
            await deleteLogbookEntry(item._backendId);
          }
          const schedId = item._type === "logbook" ? item._scheduleId : item._backendId;
          if (schedId) {
            result = await deleteEntry(schedId);
          }
        } else {
          result = (item._type === "logbook" || item.status === "dipesan" || item.status === "diterima" || item.status === "selesai")
            ? await deleteLogbookEntry(item._backendId)
            : await deleteEntry(item._backendId);
        }

        if (result && result.success) {
          await Swal.fire({
            icon: "success",
            title: "Berhasil",
            text: "Data berhasil dihapus.",
          });

          await refreshAllAdminData();
        } else {
          Swal.fire({
            icon: "error",
            title: "Gagal",
            text: `Gagal menghapus: ${result.message}`,
          });
        }
      } catch (err) {
        Swal.fire({
          icon: "error",
          title: "Koneksi Bermasalah",
          text: "Gagal menghubungi server. Periksa koneksi Anda.",
        });
      }
    } else {
      // Data lokal tidak perlu disinkronkan ke riwayat backend karena tidak memiliki ID backend aktif
      setMySchedules(mySchedules.filter((s) => s.id !== id));
      await refreshHistoryData();

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Data berhasil dihapus.",
      });
    }
  };

  // Clear all data (Logbook & Jadwal) via backend API
  const handleClearAllData = async () => {
    // Pop-up 1: "apakah kamu yakin ?"
    const confirmation1 = await Swal.fire({
      title: "Apakah kamu yakin?",
      text: "Tindakan ini akan mengosongkan/menghapus seluruh data logbook dan jadwal perkuliahan!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Lanjutkan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
    });

    if (!confirmation1.isConfirmed) return;

    // Pop-up 2: "jika yakin silakan input 'DELETE' untuk menghapus"
    const confirmation2 = await Swal.fire({
      title: "Konfirmasi Penghapusan",
      text: 'Jika yakin, silakan input "DELETE" untuk menghapus seluruh data:',
      input: "text",
      inputPlaceholder: "DELETE",
      showCancelButton: true,
      confirmButtonText: "Hapus Semua",
      cancelButtonText: "Batal",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      inputValidator: (value) => {
        if (value !== "DELETE") {
          return 'Anda harus mengetik "DELETE" (dengan huruf kapital)!';
        }
      }
    });

    if (!confirmation2.isConfirmed || confirmation2.value !== "DELETE") return;

    // Call both endpoints
    try {
      Swal.fire({
        title: "Sedang menghapus...",
        text: "Mohon tunggu sebentar.",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const [logbookRes, scheduleRes] = await Promise.all([
        clearAllLogbooks(),
        clearAllSchedules(),
      ]);

      if (logbookRes.success && scheduleRes.success) {
        localStorage.removeItem("deleted_logbooks");
        await Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: "Seluruh data logbook dan jadwal berhasil dikosongkan.",
          confirmButtonColor: "#3b82f6"
        });
        await refreshAllAdminData();
      } else {
        const errorMsg = [
          !logbookRes.success && `Logbook: ${logbookRes.message}`,
          !scheduleRes.success && `Jadwal: ${scheduleRes.message}`,
        ].filter(Boolean).join(" | ");

        Swal.fire({
          icon: "error",
          title: "Sebagian atau Seluruh Data Gagal Dihapus",
          text: errorMsg,
          confirmButtonColor: "#3b82f6"
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Koneksi Bermasalah",
        text: "Gagal menghubungi server. Periksa koneksi Anda.",
        confirmButtonColor: "#3b82f6"
      });
    }
  };

  // Approve booking (Terima) - adds notification to student
  const handleApprove = async (log) => {
  const result = await updateBookingStatus(log.id, "diterima");

  if (!result.success) {
    Swal.fire({
      icon: "error",
      title: "Gagal",
      text: `Gagal menyetujui pemesanan: ${result.message}`,
    });
    return;
  }

  setMySchedules(
    mySchedules.map((s) =>
      s.id === log.id ? { ...s, status: "diterima" } : s
    )
  );

  addNotification({
    type: "diterima",
    title: "Pemesanan Laboratorium Diterima! ✅",
    message: `Halo ${log.mahasiswa || "Mahasiswa"}! Pemesanan ${log.ruang} untuk mata kuliah "${log.matkul}" pada ${log.hari}, ${log.jam} telah DITERIMA oleh admin. Selamat menggunakan laboratorium!`,
    mahasiswa: log.mahasiswa,
    nim: log.nim,
    ruang: log.ruang,
    matkul: log.matkul,
    hari: log.hari,
    jam: log.jam,
  });

  Swal.fire({
    icon: "success",
    title: "Pemesanan Disetujui",
    text: `Pemesanan ${log.mahasiswa || "mahasiswa"} berhasil diterima. Notifikasi telah dikirim.`,
    confirmButtonText: "OK",
  });
};
  // Reject booking (Tolak) - adds notification to student
  const handleReject = async (log) => {
    const { value: alasan, isDismissed } = await Swal.fire({
      title: "Alasan Penolakan",
      text: `Masukkan alasan penolakan untuk ${log.mahasiswa || "mahasiswa"} (opsional):`,
      input: "text",
      inputPlaceholder: "Masukkan alasan penolakan...",
      showCancelButton: true,
      confirmButtonText: "Tolak",
      cancelButtonText: "Batal",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b"
    });

    if (isDismissed) return;

    const result = await updateBookingStatus(log.id, "ditolak");
    if (!result.success) {
      Swal.fire({
        icon: "error",
        title: "Gagal Menolak",
        text: `Gagal menolak pemesanan: ${result.message}`
      });
      return;
    }

    setMySchedules(mySchedules.map(s =>
      s.id === log.id ? { ...s, status: "ditolak" } : s
    ));
    addNotification({
      type: "ditolak",
      title: "Pemesanan Laboratorium Ditolak ❌",
      message: `Halo ${log.mahasiswa || "Mahasiswa"}! Mohon maaf, pemesanan ${log.ruang} untuk mata kuliah "${log.matkul}" pada ${log.hari}, ${log.jam} telah DITOLAK oleh admin.${alasan ? ` Alasan: ${alasan}` : ""} Silakan hubungi admin untuk informasi lebih lanjut.`,
      mahasiswa: log.mahasiswa,
      nim: log.nim,
      ruang: log.ruang,
      matkul: log.matkul,
      hari: log.hari,
      jam: log.jam,
      alasan: alasan || "",
    });
    Swal.fire({
      icon: "success",
      title: "Pemesanan Ditolak",
      text: `Pemesanan ${log.mahasiswa || "mahasiswa"} berhasil DITOLAK. Notifikasi telah dikirim.`,
      confirmButtonText: "OK",
      confirmButtonColor: "#3b82f6"
    });
  };

  // Open Edit Modal
  const openEditModal = (log) => {
    setEditingLog(log);
    setEditFormData({
      hari: log.hari || "",
      jam: log.jam || "",
      dosen: log.dosen || "",
      prodi: log.prodi || "",
      kelas: log.kelas || "",
      matkul: log.matkul || "",
      ruang: log.ruang || "",
      tanggalInput: log.tanggalInput || "",
      mahasiswa: log.mahasiswa || "",
      nim: log.nim || "",
      numberwa: log.numberwa || "",
      jumlahHadir: log.jumlahHadir || ""
    });
  };

  // Handle Save Edit
const handleSaveEdit = (e) => {
  e.preventDefault();

  const parsedHadir = parseInt(editFormData.jumlahHadir, 10) || 0;

  if (parsedHadir > 36) {
    Swal.fire({
      icon: "warning",
      title: "Jumlah Hadir Tidak Valid",
      text: "Jumlah hadir maksimal 36 orang.",
    });
    return;
  }

  setMySchedules(
    mySchedules.map((log) =>
      log.id === editingLog.id
        ? {
            ...log,
            ...editFormData,
            jumlahHadir: parsedHadir,
          }
        : log
    )
  );

  setEditingLog(null);

  Swal.fire({
    icon: "success",
    title: "Berhasil",
    text: "Data berhasil diperbarui.",
  });
};

  // Bulk Approve (Terima Terpilih)
  const handleBulkApprove = async () => {
    if (selectedLogIds.length === 0) return;
    
    const confirmation = await Swal.fire({
      title: "Setujui Pemesanan Terpilih?",
      text: `Apakah Anda yakin ingin MENERIMA ${selectedLogIds.length} pemesanan terpilih?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Terima",
      cancelButtonText: "Batal",
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#64748b"
    });

    if (!confirmation.isConfirmed) return;

    const selectedLogs = mySchedules.filter(s => selectedLogIds.includes(s.id));
    
    const results = await Promise.all(selectedLogs.map(log => updateBookingStatus(log.id, "diterima")));
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      Swal.fire({
        icon: "error",
        title: "Gagal memproses beberapa pemesanan",
        text: `Gagal memproses beberapa pemesanan (${failed.length} gagal).`
      });
    }

    setMySchedules(mySchedules.map(s =>
      selectedLogIds.includes(s.id) ? { ...s, status: "diterima" } : s
    ));

    selectedLogs.forEach(log => {
      addNotification({
        type: "diterima",
        title: "Pemesanan Laboratorium Diterima! ✅",
        message: `Halo ${log.mahasiswa || "Mahasiswa"}! Pemesanan ${log.ruang} untuk mata kuliah "${log.matkul}" pada ${log.hari}, ${log.jam} telah DITERIMA oleh admin. Selamat menggunakan laboratorium!`,
        mahasiswa: log.mahasiswa,
        nim: log.nim,
        ruang: log.ruang,
        matkul: log.matkul,
        hari: log.hari,
        jam: log.jam,
      });
    });

    setSelectedLogIds([]);
    Swal.fire({
      icon: "success",
      title: "Berhasil",
      text: `✅ Berhasil menerima ${selectedLogs.length - failed.length} pemesanan.`,
      confirmButtonColor: "#3b82f6"
    });
  };

  // Bulk Reject (Tolak Terpilih)
  const handleBulkReject = async () => {
    if (selectedLogIds.length === 0) return;

    const { value: alasan, isDismissed } = await Swal.fire({
      title: "Tolak Pemesanan Terpilih",
      text: `Apakah Anda yakin ingin MENOLAK ${selectedLogIds.length} pemesanan terpilih? Masukkan alasan penolakan (opsional):`,
      input: "text",
      inputPlaceholder: "Masukkan alasan penolakan...",
      showCancelButton: true,
      confirmButtonText: "Ya, Tolak",
      cancelButtonText: "Batal",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b"
    });

    if (isDismissed) return;

    const selectedLogs = mySchedules.filter(s => selectedLogIds.includes(s.id));

    const results = await Promise.all(selectedLogs.map(log => updateBookingStatus(log.id, "ditolak")));
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: `Gagal memproses penolakan beberapa pemesanan (${failed.length} gagal).`
      });
    }

    setMySchedules(mySchedules.map(s =>
      selectedLogIds.includes(s.id) ? { ...s, status: "ditolak" } : s
    ));

    selectedLogs.forEach(log => {
      addNotification({
        type: "ditolak",
        title: "Pemesanan Laboratorium Ditolak ❌",
        message: `Halo ${log.mahasiswa || "Mahasiswa"}! Mohon maaf, pemesanan ${log.ruang} untuk mata kuliah "${log.matkul}" pada ${log.hari}, ${log.jam} telah DITOLAK oleh admin.${alasan ? ` Alasan: ${alasan}` : ""} Silakan hubungi admin untuk informasi lebih lanjut.`,
        mahasiswa: log.mahasiswa,
        nim: log.nim,
        ruang: log.ruang,
        matkul: log.matkul,
        hari: log.hari,
        jam: log.jam,
        alasan: alasan || "",
      });
    });

    setSelectedLogIds([]);
    Swal.fire({
      icon: "success",
      title: "Berhasil",
      text: `❌ Berhasil menolak ${selectedLogs.length - failed.length} pemesanan.`,
      confirmButtonColor: "#3b82f6"
    });
  };

  // Bulk Delete (Hapus Terpilih)
  const handleBulkDelete = async () => {
    if (selectedLogIds.length === 0) return;

    const confirmation = await Swal.fire({
      title: "Hapus Log Terpilih?",
      text: `Apakah Anda yakin ingin MENGHAPUS ${selectedLogIds.length} log penggunaan terpilih?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b"
    });

    if (confirmation.isConfirmed) {
      let bulkDeleteSuccess = true;
      
      for (const s of mySchedules) {
        if (selectedLogIds.includes(s.id)) {
          let deleteResult = null;
          
          // 1. Simpan ke history (try-catch terisolasi agar tidak menghalangi penghapusan aktif)
          try {
            if (s._type === "logbook" || s.status === "dipesan" || s.status === "diterima" || s.status === "selesai") {
              const schedHistRes = await postHistorySchedule(formatSchedulePayload(s));
              if (schedHistRes && schedHistRes.success) {
                const newHistSchedId = schedHistRes.data?.newHistoryScheduleId || schedHistRes.data?.insertId || schedHistRes.data?.id || schedHistRes.data?.message?.newHistoryScheduleId || schedHistRes.data?.message?.id;
                const logbookPayload = formatLogbookPayload(s, newHistSchedId);
                await postHistoryLogbook(logbookPayload);
              }
            } else {
              await postHistorySchedule(formatSchedulePayload(s));
            }
          } catch (histErr) {
            console.error("Gagal mencatat riwayat ke history (bulk delete):", histErr);
          }

          // 2. Hapus data aktif dari server
          try {
            const isUmPtkin = s.source === "um_ptkin" || s.prodi === "UM PTKIN";
            if (isUmPtkin) {
              if (s._type === "logbook" && s._backendId) {
                await deleteLogbookEntry(s._backendId);
              }
              const schedId = s._type === "logbook" ? s._scheduleId : s._backendId;
              if (schedId) {
                deleteResult = await deleteEntry(schedId);
              }
            } else {
              if (s._backendId) {
                deleteResult = (s._type === "logbook" || s.status === "dipesan" || s.status === "diterima" || s.status === "selesai")
                  ? await deleteLogbookEntry(s._backendId)
                  : await deleteEntry(s._backendId);
              }
            }
            
            if (deleteResult && !deleteResult.success) {
              bulkDeleteSuccess = false;
              console.error(`Gagal menghapus data aktif dari server untuk ID:`, s._backendId);
            }
          } catch (delErr) {
            console.error(`Error saat menghapus data aktif bulk delete:`, delErr);
            bulkDeleteSuccess = false;
          }
        }
      }
      setMySchedules(mySchedules.filter(s => !selectedLogIds.includes(s.id)));
      setSelectedLogIds([]);
      await refreshAllAdminData();
      Swal.fire({
        icon: bulkDeleteSuccess ? "success" : "warning",
        title: bulkDeleteSuccess ? "Berhasil" : "Selesai dengan Peringatan",
        text: bulkDeleteSuccess ? "✅ Berhasil menghapus log terpilih dari server." : "⚠️ Beberapa data gagal dihapus dari server.",
        confirmButtonColor: "#3b82f6"
      });
    }
  };



  // Data Penggunaan Filtered Output
  const filteredUsage = mySchedules.filter((log) => {
    // Sesi logbook yang sudah selesai dipindahkan ke Laporan, 
    // sehingga di tab Data Penggunaan aktif tidak menampilkan data mahasiswanya lagi
    if (log._type === "logbook" && log.status === "selesai") {
      return false;
    }

    const matchesSearch = 
      log.dosen.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.matkul.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.kelas.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.mahasiswa && log.mahasiswa.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.nim && log.nim.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesHari = filterHari ? log.hari === filterHari : true;
    const matchesProdi = filterProdi ? log.prodi === filterProdi : true;
    const matchesStatus = filterStatus 
      ? (filterStatus === "dipesan" 
          ? (log.status === "dipesan" || log.status === "diterima") 
          : log.status === filterStatus) 
      : true;
    const matchesSource = filterSource ? log.source === filterSource : true;

    return matchesSearch && matchesHari && matchesProdi && matchesStatus && matchesSource;
  }).sort((a, b) => {
    // FIFO: First In First Out — urutkan berdasarkan tanggal & jam paling awal dulu
    // 1. Sort by tanggalInput (YYYY-MM-DD) ascending
    const dateA = a.tanggalInput || "";
    const dateB = b.tanggalInput || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    // 2. Jika tanggal sama, sort by jam mulai ascending
    // Jam format: "HH:MM - HH:MM", ambil jam mulai saja
    const getStartTime = (jam) => {
      if (!jam || jam === "-") return "00:00";
      const parts = jam.split("-");
      return (parts[0] || "00:00").trim();
    };
    const timeA = getStartTime(a.jam);
    const timeB = getStartTime(b.jam);
    return timeA.localeCompare(timeB);
  });

  // Data Penggunaan Pagination
  const totalPages = Math.ceil(filteredUsage.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsage.slice(indexOfFirstItem, indexOfLastItem);

  // Laporan Filtered Output
  const mappedHistSchedules = historySchedules.map(mapHistorySchedule);
  const allSchedulesForLookup = [...mappedHistSchedules, ...mySchedules];
  const mappedHistLogbooks = historyLogbooks.map(item => mapHistoryLogbook(item, allSchedulesForLookup));

  // Set ID jadwal yang sudah dipesan / ada di logbook riwayat
  const bookedScheduleIds = new Set(mappedHistLogbooks.map(lb => lb._scheduleId).filter(Boolean));

  // Sembunyikan jadwal yang sudah ada di logbook riwayat (jangan tampilkan)
  const unbookedSchedules = mappedHistSchedules.filter(
    s => !bookedScheduleIds.has(s.id) && !bookedScheduleIds.has(s._backendId)
  );

  // Jadwal yang ada di logbook mendapatkan status "terpakai", sedangkan yang tidak ada mendapatkan status "tidak terpakai".
  // Khusus untuk UM PTKIN, statusnya otomatis selalu dianggap "terpakai" karena agenda ujian resmi.
  const allSchedulesForReport = [
    ...mappedHistLogbooks.map(lb => ({ ...lb, status: "terpakai" })),
    ...unbookedSchedules.map(s => {
      const isUmPtkin = s.source === "um_ptkin" || s.prodi === "UM PTKIN";
      return {
        ...s,
        status: isUmPtkin ? "terpakai" : "tidak terpakai"
      };
    })
  ];

  const reportFilteredUsage = allSchedulesForReport.filter((log) => {
    // 1. Filter Tanggal (hanya berlaku jika reportType === "semua")
    let matchesDate = true;
    if (reportType === "semua" && (startDate || endDate)) {
      const logDate = new Date(log.tanggalInput);
      if (startDate && !endDate) {
        matchesDate = logDate >= new Date(startDate);
      } else if (!startDate && endDate) {
        matchesDate = logDate <= new Date(endDate);
      } else if (startDate && endDate) {
        matchesDate = logDate >= new Date(startDate) && logDate <= new Date(endDate);
      }
    }

    // 2. Filter Jenis Laporan (Periode Akademik)
    let matchesType = true;
    if (reportType === "harian") {
      const logDate = new Date(log.tanggalInput).toDateString();
      const todayDate = new Date().toDateString();
      matchesType = logDate === todayDate;
    } else if (reportType === "semester1") {
      // Semester 1 (Ganjil): Agustus s/d Januari (Bulan 8, 9, 10, 11, 12, 1)
      if (log.tanggalInput) {
        const d = new Date(log.tanggalInput);
        const m = d.getMonth() + 1;
        const y = d.getFullYear().toString();
        const matchYear = !reportYear || y === reportYear;
        const isSem1 = m >= 8 || m === 1;
        matchesType = isSem1 && matchYear;
      }
    } else if (reportType === "semester2") {
      // Semester 2 (Genap): Februari s/d Agustus (Bulan 2, 3, 4, 5, 6, 7, 8)
      if (log.tanggalInput) {
        const d = new Date(log.tanggalInput);
        const m = d.getMonth() + 1;
        const y = d.getFullYear().toString();
        const matchYear = !reportYear || y === reportYear;
        const isSem2 = m >= 2 && m <= 8;
        matchesType = isSem2 && matchYear;
      }
    } else if (reportType === "bulanan") {
      if (log.tanggalInput) {
        const d = new Date(log.tanggalInput);
        const m = (d.getMonth() + 1).toString();
        const y = d.getFullYear().toString();
        const matchMonth = !reportMonth || m === reportMonth;
        const matchYear = !reportYear || y === reportYear;
        matchesType = matchMonth && matchYear;
      }
    }

    // 3. Filter Status Keterisian (Terpakai / Tidak Terpakai)
    let matchesStatus = true;
    if (reportStatus === "terpakai") {
      matchesStatus = log.status === "terpakai";
    } else if (reportStatus === "tidak terpakai") {
      matchesStatus = log.status === "tidak terpakai";
    }

    return matchesDate && matchesType && matchesStatus;
  }).sort((a, b) => {
    const dateA = a.tanggalInput || a.tanggal || "";
    const dateB = b.tanggalInput || b.tanggal || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    const getStartTime = (jamStr) => {
      if (!jamStr || jamStr === "-") return "00:00";
      const parts = jamStr.split("-");
      return (parts[0] || "00:00").trim();
    };
    const timeA = getStartTime(a.jam);
    const timeB = getStartTime(b.jam);
    return timeA.localeCompare(timeB);
  });

  // Debug data laporan untuk kebutuhan analisis backend/frontend
  console.log("=== DEBUG DATA LAPORAN ===");
  console.log("historySchedules (Raw Riwayat Jadwal):", historySchedules);
  console.log("historyLogbooks (Raw Riwayat Logbook):", historyLogbooks);
  console.log("mySchedules (Raw Jadwal Aktif):", mySchedules);
  console.log("mappedHistSchedules (Jadwal Riwayat Terpetakan):", mappedHistSchedules);
  console.log("mappedHistLogbooks (Logbook Riwayat Terpetakan):", mappedHistLogbooks);
  console.log("unbookedSchedules (Jadwal Tanpa Logbook):", unbookedSchedules);
  console.log("allSchedulesForReport (Gabungan Riwayat + Aktif):", allSchedulesForReport);
  console.log("reportFilteredUsage (Data Laporan Terfilter yang Tampil):", reportFilteredUsage);
  console.log("==========================");

  // Export Report to Excel (.xlsx) using SheetJS
  const exportExcel = () => {
    if (reportFilteredUsage.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Gagal Ekspor",
        text: "Tidak ada data untuk diekspor!",
        confirmButtonColor: "#3b82f6"
      });
      return;
    }
    const headers = ["Hari", "Jam", "Nama Dosen", "Prodi", "Kelas", "Mata Kuliah", "Laboratorium", "Tanggal Input", "Nama Mahasiswa", "NIM", "No WA", "Jumlah Hadir", "Status"];
    const rows = reportFilteredUsage.map(s => [
      s.hari, 
      s.jam, 
      s.dosen, 
      s.prodi, 
      s.kelas, 
      s.matkul, 
      s.ruang, 
      s.tanggalInput,
      s.status === "tidak terpakai" ? "Belum Dipesan" : (s.mahasiswa || "-"),
      s.status === "tidak terpakai" ? "Belum Dipesan" : (s.nim || "-"),
      s.status === "tidak terpakai" ? "Belum Dipesan" : (s.numberwa || "-"),
      s.status === "tidak terpakai" ? 0 : (s.jumlahHadir || 0),
      s.status === "tidak terpakai" ? "Tidak Terpakai" : "Terpakai"
    ]);
    
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Auto-fit columns
    const maxCols = headers.length;
    const colWidths = [];
    for (let colIdx = 0; colIdx < maxCols; colIdx++) {
      let maxLen = headers[colIdx].length;
      for (let rowIdx = 0; rowIdx < wsData.length; rowIdx++) {
        const cellValue = wsData[rowIdx][colIdx];
        if (cellValue != null) {
          maxLen = Math.max(maxLen, String(cellValue).length);
        }
      }
      colWidths.push({ wch: maxLen + 3 });
    }
    ws["!cols"] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Logbook");
    
    const dateStr = `${reportType}_${reportStatus}_${startDate || "semua"}_sd_${endDate || "semua"}`;
    XLSX.writeFile(wb, `laporan_logbook_${dateStr}.xlsx`);
  };

  // Export Report to PDF using jsPDF and jspdf-autotable
  const exportPDF = () => {
    if (reportFilteredUsage.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Gagal Ekspor",
        text: "Tidak ada data untuk diekspor!",
        confirmButtonColor: "#3b82f6"
      });
      return;
    }
    
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });
    
    // Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text("LAPORAN LOG BOOK PENGGUNAAN LABORATORIUM", 14, 18);
    
    // Subtitle / Date range
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    const dateRangeStr = `Periode: ${reportType === "harian" ? "Harian (Hari Ini)" : reportType === "semester" ? "Semester (6 Bulan Terakhir)" : `Kustom (${startDate || "Awal"} s.d. ${endDate || "Sekarang"})`} | Status: ${reportStatus === "terpakai" ? "Terpakai" : reportStatus === "tidak terpakai" ? "Tidak Terpakai" : "Semua Status"}`;
    doc.text(dateRangeStr, 14, 24);
    
    const tableHeaders = [
      ["No", "Tanggal", "Hari", "Jam", "Ruang/Lab", "Dosen", "Mata Kuliah", "Prodi / Kelas", "Mahasiswa (PJ)", "NIM", "No WA", "Hadir", "Status"]
    ];
    
    const tableRows = reportFilteredUsage.map((s, idx) => [
      idx + 1,
      s.tanggalInput,
      s.hari,
      s.jam,
      s.ruang,
      s.dosen,
      s.matkul,
      `${s.prodi} (${s.kelas})`,
      s.status === "tidak terpakai" ? "Belum Dipesan" : (s.mahasiswa || "-"),
      s.status === "tidak terpakai" ? "Belum Dipesan" : (s.nim || "-"),
      s.status === "tidak terpakai" ? "Belum Dipesan" : (s.numberwa || "-"),
      s.status === "tidak terpakai" ? "-" : (s.jumlahHadir || 0),
      s.status === "tidak terpakai" ? "Tidak Terpakai" : "Terpakai"
    ]);
    
    doc.autoTable({
      head: tableHeaders,
      body: tableRows,
      startY: 28,
      theme: "striped",
      headStyles: {
        fillColor: [75, 143, 202], // #4b8fca
        textColor: 255,
        fontSize: 8,
        fontStyle: "bold"
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: 50
      },
      columnStyles: {
        0: { cellWidth: 8 },  // No
        1: { cellWidth: 18 }, // Tanggal
        2: { cellWidth: 12 }, // Hari
        3: { cellWidth: 20 }, // Jam
        4: { cellWidth: 20 }, // Ruang/Lab
        5: { cellWidth: 25 }, // Dosen
        6: { cellWidth: 30 }, // Mata Kuliah
        7: { cellWidth: 25 }, // Prodi/Kelas
        8: { cellWidth: 25 }, // Mahasiswa (PJ)
        9: { cellWidth: 18 }, // NIM
        10: { cellWidth: 22 }, // No WA
        11: { cellWidth: 10 }, // Hadir
        12: { cellWidth: 15 }  // Status
      },
      margin: { top: 28, left: 14, right: 14 },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(150);
        const str = `Halaman ${doc.internal.getNumberOfPages()}`;
        doc.text(str, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
      }
    });
    
    const dateStr = `${reportType}_${reportStatus}_${startDate || "semua"}_sd_${endDate || "semua"}`;
    doc.save(`laporan_logbook_${dateStr}.pdf`);
  };

  // Browser print layout trigger
  const printReport = () => {
    window.print();
  };

  // Download Excel Template for importing
  const downloadTemplate = () => {
    const headers = [
      "Hari", 
      "Jam", 
      "Mata Kuliah", 
      "Nama Dosen", 
      "Program Studi", 
      "Kelas"
    ];
    
    const sampleRow1 = [
      "Senin", 
      "08:00 - 10:00", 
      "Pemrograman Web", 
      "Dr. Budi", 
      "Teknik Informatika", 
      "TI-4A"
    ];
    
    const sampleRow2 = [
      "Selasa", 
      "13:00 - 15:30", 
      "Data Mining", 
      "Dr. Ani", 
      "Sains Data", 
      "SD-2B"
    ];
    
    const wsData = [headers, sampleRow1, sampleRow2];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      [sampleRow1, sampleRow2].forEach(row => {
        maxLen = Math.max(maxLen, String(row[i]).length);
      });
      return { wch: maxLen + 3 };
    });
    ws["!cols"] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_import_jadwal.xlsx");
  };

  // Parse Excel / CSV files upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0] || (e.dataTransfer && e.dataTransfer.files[0]);
    if (!file) return;
    
    setImportFileName(file.name);
    setImportError("");
    setImportedSchedules([]);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let worksheet = null;
        let sheetName = "";
        let rows = [];
        
        // Loop through all sheets in the workbook to search for the one that has the header row
        for (let i = 0; i < workbook.SheetNames.length; i++) {
          const name = workbook.SheetNames[i];
          const ws = workbook.Sheets[name];
          const wsRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          
          let foundHeader = false;
          for (let r = 0; r < Math.min(wsRows.length, 50); r++) {
            const row = wsRows[r];
            if (!row || row.length === 0) continue;
            const rowStrings = row.map(cell => String(cell || "").toLowerCase().trim());
            const hasHari = rowStrings.some(s => s === "hari");
            const hasJam = rowStrings.some(s => s === "jam" || s === "waktu");
            const hasMatkul = rowStrings.some(s => s.includes("matkul") || s.includes("mata kuliah") || s.includes("matakuliah"));
            
            if (hasHari && (hasJam || hasMatkul)) {
              foundHeader = true;
              break;
            }
          }
          if (foundHeader) {
            worksheet = ws;
            sheetName = name;
            rows = wsRows;
            break;
          }
        }
        
        // Fallback if no sheet has identified headers
        if (!worksheet) {
          if (workbook.SheetNames.length >= 2) {
            sheetName = workbook.SheetNames[1];
            worksheet = workbook.Sheets[sheetName];
            rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          } else if (workbook.SheetNames.length >= 1) {
            sheetName = workbook.SheetNames[0];
            worksheet = workbook.Sheets[sheetName];
            rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          } else {
            throw new Error("Tidak ada sheet yang ditemukan pada file Excel.");
          }
        }
        if (rows.length === 0) {
          setImportError("File kosong!");
          return;
        }
        
        // 1. Find the header row (the row containing column names like Hari, Jam, Mata Kuliah, Dosen)
        let headerRowIdx = -1;
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;
          
          const rowStrings = row.map(cell => String(cell || "").toLowerCase().trim());
          const hasHari = rowStrings.some(s => s === "hari");
          const hasJam = rowStrings.some(s => s === "jam" || s === "waktu");
          const hasMatkul = rowStrings.some(s => s.includes("matkul") || s.includes("mata kuliah") || s.includes("matakuliah"));
          
          if (hasHari && (hasJam || hasMatkul)) {
            headerRowIdx = r;
            break;
          }
        }
        
        if (headerRowIdx === -1) {
          setImportError("Format berkas tidak sesuai. Pastikan ada baris kepala tabel dengan kolom 'Hari' dan 'Jam' atau 'Mata Kuliah'.");
          return;
        }
        
        const headers = rows[headerRowIdx].map(h => String(h || "").trim().toLowerCase());
        const dataRows = rows.slice(headerRowIdx + 1);
        
        const getColIdx = (aliases) => {
          return headers.findIndex(h => aliases.some(alias => h.includes(alias)));
        };
        
        const indices = {
          hari: getColIdx(["hari"]),
          jam: getColIdx(["jam", "waktu"]),
          dosen: getColIdx(["dosen", "pengampu", "nama dosen"]),
          prodi: getColIdx(["prodi", "program studi", "jurusan"]),
          kelas: getColIdx(["kelas"]),
          matkul: getColIdx(["mata kuliah", "matkul", "matakuliah"]),
          ruang: getColIdx(["laboratorium", "ruangan", "ruang", "lab"]),
          tanggalInput: getColIdx(["tanggal"]),
          mahasiswa: getColIdx(["mahasiswa", "penanggung jawab", "pj"]),
          nim: getColIdx(["nim"]),
          numberwa: getColIdx(["wa", "whatsapp", "nomor wa", "no hp"]),
          jumlahHadir: getColIdx(["jumlah hadir", "kehadiran", "hadir"])
        };
        
        // 2. Scan rows BEFORE headerRowIdx for the Laboratory name
        let detectedLabName = "";
        for (let r = 0; r < headerRowIdx; r++) {
          const row = rows[r];
          if (!row) continue;
          for (let c = 0; c < row.length; c++) {
            const cellVal = String(row[c] || "");
            if (cellVal.toLowerCase().includes("laboratorium") || cellVal.toLowerCase().includes("lab")) {
              if (cellVal.includes(":")) {
                const parts = cellVal.split(":");
                if (parts.length > 1 && parts[1].trim()) {
                  detectedLabName = parts[1].trim();
                  break;
                }
              } else if (c + 1 < row.length && row[c + 1]) {
                detectedLabName = String(row[c + 1]).trim();
                break;
              }
            }
          }
          if (detectedLabName) break;
        }
        
        // Normalize lab name
        let finalLab = importDefaultLab || "";
        if (detectedLabName) {
          const lowerLab = detectedLabName.toLowerCase();
          const matched = laboratories.find(l => 
            l.name.toLowerCase().includes(lowerLab) || lowerLab.includes(l.name.toLowerCase())
          );
          if (matched) {
            finalLab = matched.name;
          } else {
            finalLab = detectedLabName;
          }
        }
        
        if (!finalLab && laboratories.length > 0) {
          finalLab = laboratories[0].name;
        }
        
        // Helper to get offset date from selected starting date
        const getActualDate = (dayName, startDateStr) => {
          if (!startDateStr) return BASE_TODAY;
          
          const daysMapping = {
            "senin": 0, "monday": 0,
            "selasa": 1, "tuesday": 1,
            "rabu": 2, "wednesday": 2,
            "kamis": 3, "thursday": 3,
            "jumat": 4, "friday": 4,
            "sabtu": 5, "saturday": 5,
            "minggu": 6, "sunday": 6
          };
          
          const normalizedDay = String(dayName).toLowerCase().trim();
          const offset = daysMapping[normalizedDay] ?? 0;
          
          const date = new Date(startDateStr);
          date.setDate(date.getDate() + offset);
          
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, "0");
          const d = String(date.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        };
        
        // Helper to normalize time format dot -> colon
        const normalizeTime = (timeStr) => {
          return String(timeStr).replace(/(\d{2})\.(\d{2})/g, "$1:$2").trim();
        };
        
        const parsed = [];
        let lastHari = "Senin";
        
        dataRows.forEach((row, rowIndex) => {
          if (row.length === 0 || row.every(cell => cell == null || cell === "")) return;
          
          const val = (idx, fallback = "-") => {
            if (idx === -1 || idx >= row.length || row[idx] == null) return fallback;
            return String(row[idx]).trim();
          };
          
          let hariVal = val(indices.hari, "").trim();
          if (hariVal) {
            lastHari = hariVal;
          } else {
            hariVal = lastHari;
          }
          
          const jamVal = val(indices.jam, "").trim();
          const matkulVal = val(indices.matkul, "").trim();
          const dosenVal = val(indices.dosen, "").trim();
          
          if (!jamVal || !matkulVal || matkulVal === "-" || jamVal === "-") return;
          if (matkulVal.toLowerCase().includes("koordinator") || matkulVal.toLowerCase().includes("laboran")) return;
          if (dosenVal.toLowerCase().includes("nip.") || dosenVal.toLowerCase().includes("nip ")) return;
          
          let tanggalInput = val(indices.tanggalInput, "");
          if (!tanggalInput) {
            tanggalInput = getActualDate(hariVal, importWeekStartDate);
          } else {
            if (!isNaN(tanggalInput) && Number(tanggalInput) > 30000) {
              const dateObj = new Date((Number(tanggalInput) - 25569) * 86400 * 1000);
              if (dateObj) {
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                tanggalInput = `${year}-${month}-${day}`;
              }
            } else if (tanggalInput.includes("/")) {
              const parts = tanggalInput.split("/");
              if (parts.length === 3) {
                if (parts[2].length === 4) {
                  tanggalInput = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                } else if (parts[0].length === 4) {
                  tanggalInput = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                }
              }
            }
          }
          
          let prodiVal = val(indices.prodi, "Umum");
          const prodiMapping = {
            "ti": "Teknik Informatika",
            "si": "Sistem Informasi",
            "sd": "Sains Data",
            "mtk": "Matematika",
            "fis": "Fisika",
            "bio": "Biologi"
          };
          const normProdi = prodiVal.toLowerCase().trim();
          if (prodiMapping[normProdi]) {
            prodiVal = prodiMapping[normProdi];
          }
          
          const hadirVal = Math.min(parseInt(val(indices.jumlahHadir, "0")) || 0, 36);
          
          parsed.push({
            id: Date.now() + rowIndex + Math.floor(Math.random() * 1000),
            hari: hariVal,
            jam: normalizeTime(jamVal),
            dosen: dosenVal || "Dosen Tanpa Nama",
            prodi: prodiVal,
            kelas: val(indices.kelas, "-"),
            matkul: matkulVal,
            ruang: finalLab,
            tanggalInput: tanggalInput,
            mahasiswa: val(indices.mahasiswa, "Admin (Penjadwalan)"),
            nim: val(indices.nim, "-"),
            numberwa: val(indices.numberwa, "-"),
            jumlahHadir: hadirVal
          });
        });
        
        if (parsed.length === 0) {
          setImportError("Tidak ada data jadwal valid yang berhasil dibaca.");
        } else {
          setImportedSchedules(parsed);
        }
      } catch (err) {
        console.error(err);
        if (err.message === "Sheet kedua tidak ditemukan pada file Excel.") {
          setImportError("Sheet kedua tidak ditemukan pada file Excel.");
        } else if (err.message) {
          setImportError(err.message);
        } else {
          setImportError("Gagal memparsing file. Silakan periksa kembali berkas Anda.");
        }
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // Save imported rows — kirim ke backend satu per satu via POST /post/formadmin
  const confirmImport = async () => {
    if (importedSchedules.length === 0) return;

    const duplicates = [];
    const nonDuplicates = [];

    for (const sched of importedSchedules) {
      let jamMulai = "08:00";
      let jamSelesai = "10:00";
      if (sched.jam && sched.jam.includes("-")) {
        const parts = sched.jam.split("-").map(s => s.trim());
        jamMulai = parts[0] || "08:00";
        jamSelesai = parts[1] || "10:00";
      }
      const normalizedJam = `${jamMulai} - ${jamSelesai}`.replace(/\s+/g, '');

      const isDuplicate = mySchedules.some(item => 
        item.ruang?.toLowerCase() === sched.ruang?.toLowerCase() &&
        item.tanggalInput === sched.tanggalInput &&
        item.jam?.replace(/\s+/g, '') === normalizedJam
      );

      if (isDuplicate) {
        duplicates.push(sched);
      } else {
        nonDuplicates.push(sched);
      }
    }

    let schedulesToImport = importedSchedules;
    let skippedCount = 0;

    if (duplicates.length > 0) {
      const confirmation = await Swal.fire({
        title: "Jadwal Duplikat Ditemukan",
        text: `Peringatan: Ditemukan ${duplicates.length} jadwal dari total ${importedSchedules.length} yang sudah terdaftar di sistem pada lab, tanggal, dan jam yang sama.\n\nApakah Anda ingin MELEWATI (skip) jadwal duplikat tersebut dan hanya mengimpor ${nonDuplicates.length} jadwal baru?\n\n- Klik "Lewati Duplikat" untuk mengimpor jadwal baru saja.\n- Klik "Impor Semua" jika ingin tetap mengimpor semua jadwal termasuk duplikat.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Lewati Duplikat",
        cancelButtonText: "Impor Semua",
        confirmButtonColor: "#eab308",
        cancelButtonColor: "#3b82f6"
      });

      const proceedSkip = confirmation.isConfirmed;

      if (proceedSkip) {
        schedulesToImport = nonDuplicates;
        skippedCount = duplicates.length;
        if (schedulesToImport.length === 0) {
          await Swal.fire({
            icon: "info",
            title: "Semua Jadwal Duplikat",
            text: "Semua jadwal yang Anda impor adalah duplikat dan telah dilewati. Tidak ada jadwal baru untuk disimpan.",
            confirmButtonColor: "#3b82f6"
          });
          setImportedSchedules([]);
          setImportFileName("");
          return;
        }
      }
    }

    let successCount = 0;
    let failCount = 0;

    for (const sched of schedulesToImport) {
      // Cari ID lab berdasarkan nama ruang
      const matchedLab = laboratories.find(l => l.name.toLowerCase() === sched.ruang.toLowerCase());
      const labId = matchedLab ? matchedLab.id : 1;

      // Parse jam mulai & selesai dari format "HH:MM - HH:MM"
      let jamMulai = "08:00";
      let jamSelesai = "10:00";
      if (sched.jam && sched.jam.includes("-")) {
        const parts = sched.jam.split("-").map(s => s.trim());
        jamMulai = parts[0] || "08:00";
        jamSelesai = parts[1] || "10:00";
      }

      try {
        const result = await createSchedule({
          labId,
          prodi: sched.prodi || "Umum",
          matkul: sched.matkul || "Mata Kuliah Umum",
          dosen: sched.dosen || "Dosen",
          tanggal: sched.tanggalInput || BASE_TODAY,
          jamMulai,
          jamSelesai,
          source: "import",
          is_auto: true,
        });
        if (result.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      await refreshAllAdminData();
    }

    let message = `${successCount} Jadwal berhasil diimpor.`;
    if (skippedCount > 0) message += ` ${skippedCount} jadwal duplikat dilewati.`;
    if (failCount > 0) message += ` ${failCount} gagal.`;
    
    await Swal.fire({
      icon: failCount > 0 ? "warning" : "success",
      title: "Hasil Impor",
      text: message,
      confirmButtonColor: "#3b82f6"
    });

    setImportedSchedules([]);
    setImportFileName("");
    setImportWeekStartDate("");
    setImportDefaultLab("");
    setActiveTab("data-penggunaan");
  };

  // RENDER LOGIN SCREEN (Logged Out state)
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50/50">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 transition-all hover:shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-4 shadow-md shadow-blue-500/10"
              style={{ backgroundColor: "#4b8fca" }}
            >
              <Lock size={30} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 font-display">Login Administrator</h2>
            <p className="text-sm text-slate-500 mt-1.5 text-center">
              Aplikasi Log Book Penggunaan Laboratorium. Silakan masuk untuk mengelola data.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-red-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition bg-slate-50/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 text-white rounded-xl font-bold text-sm shadow-md transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: "#4b8fca" }}
            >
              {isLoading ? "Masuk..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Laporan Analisis dynamic stats calculations
  const activeLabObject = labPercentages.find(l => String(l.id_lab) === String(selectedLabId)) || labPercentages[0] || {};



  // Mode Reguler vs Mode Combined (UM PTKIN)
  const isModeCombined = !persentaseOnlyAuto; // checkbox checked = mode combined/umptkin

  // 1. Dapatkan data active semester dan per_lab dari historyTerbaruData atau historyPerhitunganUmptkin/Reguler
  let backendLabData = null;
  let backendSchedulesList = null;
  let semData = null;
  let dataSrc = null;

  const currentHistoryObj = historyTerbaruData || (isModeCombined ? historyPerhitunganUmptkin : historyPerhitunganReguler);
  if (currentHistoryObj) {
    if (currentHistoryObj.data_per_semester) {
      dataSrc = currentHistoryObj.data_per_semester;
    } else if (currentHistoryObj.data?.data_per_semester) {
      dataSrc = currentHistoryObj.data.data_per_semester;
    } else if (currentHistoryObj.data) {
      dataSrc = currentHistoryObj.data;
    } else {
      dataSrc = currentHistoryObj;
    }
  }

  const stripSeconds = (timeStr) => {
    if (!timeStr) return "";
    const parts = String(timeStr).split(":");
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return String(timeStr);
  };

  const getIndonesianDayName = (dateStr) => {
    if (!dateStr) return "Senin";
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const d = new Date(dateStr);
    return days[d.getDay()] || "Senin";
  };

  const formatScheduleItem = (item, idx) => {
    if (!item) return null;
    const jamMulai = stripSeconds(item.jammulai || item.jam_mulai || "");
    const jamSelesai = stripSeconds(item.jamselesai || item.jam_selesai || "");
    const jam = jamMulai && jamSelesai ? `${jamMulai} - ${jamSelesai}` : (item.jam || "-");
    
    let prodi = item.prodi || "";
    let kelas = item.kelas || "";
    if (!prodi && item.prodi_kelas) {
      const pk = String(item.prodi_kelas).trim();
      const match = pk.match(/(.*?)\s+(\d+[A-Za-z]?)$/);
      if (match) {
        prodi = match[1];
        kelas = match[2];
      } else {
        prodi = pk;
        kelas = "-";
      }
    }

    let dosen = item.dosen || item.dosennya || "";
    if (!dosen || dosen === "1" || dosen === "2" || dosen === "3" || dosen === "4") {
      if (prodi === "UM PTKIN" || item.prodi_kelas === "UM PTKIN" || item.matkul === "UM PTKIN") {
        dosen = item.dosen ? `Pengawas Sesi ${item.dosen}` : "Pengawas UM PTKIN";
      } else if (!dosen) {
        dosen = "-";
      }
    }

    return {
      id: item.id || `sched-backend-${idx}-${item.tanggal || ""}`,
      hari: item.hari || (item.tanggal ? getIndonesianDayName(item.tanggal) : "Senin"),
      jam,
      jam_mulai: jamMulai,
      jam_selesai: jamSelesai,
      tanggal: item.tanggal || "",
      dosen,
      prodi: prodi || "Umum",
      kelas: kelas || "-",
      matkul: item.matkul || item.matkulnya || (prodi === "UM PTKIN" || item.prodi_kelas === "UM PTKIN" ? "UM PTKIN" : "Mata Kuliah Umum"),
      id_lab: item.lab_id || item.id_lab || null,
      ruang: item.nama_lab || "",
      durasi_menit: item.durasi_menit !== undefined ? item.durasi_menit : null
    };
  };

  if (dataSrc) {
    const lowerSem = (analisisSemester || "s1").toLowerCase();
    const isSem2 = lowerSem.includes("genap") || lowerSem.includes("2") || lowerSem === "s2";
    const semKey = isSem2 ? "Semester 2 (Genap)" : "Semester 1 (Ganjil)";
    semData = dataSrc[semKey] || dataSrc;
    if (semData && Array.isArray(semData.per_lab)) {
      backendLabData = semData.per_lab.find(l => 
        l && (String(l.id_lab) === String(selectedLabId) ||
        String(l.nama_lab).toLowerCase() === String(activeLabObject.nama_lab).toLowerCase())
      );
      if (backendLabData && Array.isArray(backendLabData.jadwal_terbaru)) {
        backendSchedulesList = backendLabData.jadwal_terbaru
          .map(formatScheduleItem)
          .filter(Boolean)
          .sort((a, b) => {
            const dateA = a.tanggal || "";
            const dateB = b.tanggal || "";
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return (a.jam_mulai || "00:00").localeCompare(b.jam_mulai || "00:00");
          });
      }
    }
  }

  // Check detail_jadwal at root level of response (e.g. Postman response format)
  const rootDetailJadwal = (isModeCombined ? historyPerhitunganUmptkin?.detail_jadwal : historyPerhitunganReguler?.detail_jadwal) || currentHistoryObj?.detail_jadwal;
  if (!backendSchedulesList && Array.isArray(rootDetailJadwal) && rootDetailJadwal.length > 0) {
    backendSchedulesList = rootDetailJadwal
      .map(formatScheduleItem)
      .filter(s => s && (selectedLabId ? (String(s.id_lab) === String(selectedLabId) || String(s.ruang).toLowerCase() === String(activeLabObject.nama_lab).toLowerCase()) : true))
      .sort((a, b) => {
        const dateA = a.tanggal || "";
        const dateB = b.tanggal || "";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.jam_mulai || "00:00").localeCompare(b.jam_mulai || "00:00");
      });
  }

  // Map and filter schedules for this lab (Local fallback)
  const mappedSchedules = getMappedSchedules(mySchedules);
  const localLabSchedulesFallback = mappedSchedules
    .filter(s => {
      const matchesLabId = s.id_lab !== null && s.id_lab !== undefined && String(s.id_lab) === String(selectedLabId);
      const matchesLabName = s.ruang && s.ruang.toLowerCase() === activeLabObject.nama_lab?.toLowerCase();
      return matchesLabId || matchesLabName;
    })
    .sort((a, b) => {
      const dateA = a.tanggal || "";
      const dateB = b.tanggal || "";
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const timeA = a.jam_mulai || "00:00";
      const timeB = b.jam_mulai || "00:00";
      return timeA.localeCompare(timeB);
    });

  const labSchedules = backendSchedulesList || localLabSchedulesFallback || [];

  // Helper parsing jam_mulai dan jam_selesai ke menit
  const getDurationInMinutes = (jamMulai, jamSelesai) => {
    if (!jamMulai || !jamSelesai) return 150; // fallback to 2.5 hours = 150 minutes
    const parseToMinutes = (timeStr) => {
      const clean = String(timeStr).trim().replace(":", ".");
      const parts = clean.split(".");
      if (parts.length < 2) return 0;
      const hrs = parseInt(parts[0], 10);
      const mins = parseInt(parts[1], 10);
      return (isNaN(hrs) ? 0 : hrs) * 60 + (isNaN(mins) ? 0 : mins);
    };
    const start = parseToMinutes(jamMulai);
    const end = parseToMinutes(jamSelesai);
    if (end > start) return end - start;
    return 150; // fallback
  };

  let regulerCount = 0;
  let umptkinCount = 0;
  let n_menit_reguler = 0;
  let n_menit_umptkin = 0;

  labSchedules.forEach(s => {
    if (!s) return;
    const checkStringIncludes = (val, search) => {
      if (!val) return false;
      return String(val).toLowerCase().includes(search.toLowerCase());
    };
    const isUmPtkin = s.prodi === "UM PTKIN" || 
                      s.matkul === "UM PTKIN" || 
                      s.ruang === "UM PTKIN" || 
                      s.kelas === "UMPTKIN" || 
                      checkStringIncludes(s.prodi, "umptkin") || 
                      checkStringIncludes(s.prodi, "um ptkin");
    const durationMin = s.durasi_menit !== undefined && s.durasi_menit !== null
      ? Number(s.durasi_menit)
      : getDurationInMinutes(s.jam_mulai, s.jam_selesai);
    if (isUmPtkin) {
      umptkinCount += 1;
      n_menit_umptkin += durationMin;
    } else {
      regulerCount += 1;
      n_menit_reguler += durationMin;
    }
  });

  const pekanReguler = 14;
  const pekanUmptkin = 1;

  const c_menit_reguler = n_menit_reguler * pekanReguler;
  const c_menit_umptkin = n_menit_umptkin * pekanUmptkin;

  const total_c_menit = isModeCombined ? (c_menit_reguler + c_menit_umptkin) : c_menit_reguler;

  // Formatting values
  const n_jam_reguler_val = n_menit_reguler / 60;
  const n_jam_reguler_formatted = (isNaN(n_jam_reguler_val) || n_jam_reguler_val === 0)
    ? "0"
    : (Number.isInteger(n_jam_reguler_val) ? n_jam_reguler_val.toString() : n_jam_reguler_val.toFixed(1).replace(".", ","));

  const c_jam_reguler_val = c_menit_reguler / 60;
  const c_jam_reguler_formatted = (isNaN(c_jam_reguler_val) || c_jam_reguler_val === 0)
    ? "0"
    : (Number.isInteger(c_jam_reguler_val) ? c_jam_reguler_val.toString() : c_jam_reguler_val.toFixed(1).replace(".", ","));

  const n_jam_umptkin_val = n_menit_umptkin / 60;
  const n_jam_umptkin_formatted = (isNaN(n_jam_umptkin_val) || n_jam_umptkin_val === 0)
    ? "0"
    : (Number.isInteger(n_jam_umptkin_val) ? n_jam_umptkin_val.toString() : n_jam_umptkin_val.toFixed(1).replace(".", ","));

  const c_jam_umptkin_val = c_menit_umptkin / 60;
  const c_jam_umptkin_formatted = (isNaN(c_jam_umptkin_val) || c_jam_umptkin_val === 0)
    ? "0"
    : (Number.isInteger(c_jam_umptkin_val) ? c_jam_umptkin_val.toString() : c_jam_umptkin_val.toFixed(1).replace(".", ","));

  const localTotalJamSemester = total_c_menit / 60;
  const localTotalJamSemesterFormatted = (isNaN(localTotalJamSemester) || localTotalJamSemester === 0)
    ? "0"
    : (Number.isInteger(localTotalJamSemester) 
        ? localTotalJamSemester.toString() 
        : localTotalJamSemester.toFixed(1).replace(".", ","));

  const localWaktuOperasionalSemester = 560; // 14 pekan x 40 jam operasional per pekan = 560 jam
  
  const localPersenPenggunaanVal = localWaktuOperasionalSemester > 0 ? ((localTotalJamSemester / localWaktuOperasionalSemester) * 100) : 0;
  const localPersenPenggunaanFormatted = localPersenPenggunaanVal.toFixed(2).replace(".", ",");

  // Priority mapping from backend GET /get/history/perhitungan or GET /get/history/terbaru response
  const getRingkasanReguler = () => {
    const targets = [
      historyPerhitunganReguler,
      historyPerhitunganUmptkin,
      backendLabData,
      semData,
      historyTerbaruData
    ];
    for (const t of targets) {
      if (!t) continue;
      if (t.ringkasan_perhitungan) return t.ringkasan_perhitungan;
      if (t.ringkasan) return t.ringkasan;
    }
    if (historyPerhitunganReguler && (historyPerhitunganReguler.total_jadwal !== undefined || historyPerhitunganReguler.n_jam !== undefined)) {
      return historyPerhitunganReguler;
    }
    return null;
  };
  const ringkasanReguler = getRingkasanReguler();

  const getRingkasanUmptkin = () => {
    if (historyPerhitunganUmptkin?.ringkasan_perhitungan) return historyPerhitunganUmptkin.ringkasan_perhitungan;
    if (historyPerhitunganUmptkin?.ringkasan) return historyPerhitunganUmptkin.ringkasan;
    if (historyPerhitunganUmptkin && (historyPerhitunganUmptkin.total_jadwal !== undefined || historyPerhitunganUmptkin.n_jam !== undefined)) {
      return historyPerhitunganUmptkin;
    }
    return null;
  };
  const ringkasanUmptkin = getRingkasanUmptkin();

  const formatNum = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "0";
    const numVal = Number(val);
    return Number.isInteger(numVal) ? numVal.toString() : numVal.toFixed(2).replace(".", ",");
  };

  // Reguler
  const displayNJamReguler = ringkasanReguler?.rincian_jam?.reguler?.n_jam !== undefined
    ? formatNum(ringkasanReguler.rincian_jam.reguler.n_jam)
    : (ringkasanUmptkin?.rincian_jam?.reguler?.n_jam !== undefined
        ? formatNum(ringkasanUmptkin.rincian_jam.reguler.n_jam)
        : (ringkasanReguler?.n_jam_reguler
            ? formatNum(ringkasanReguler.n_jam_reguler) 
            : (ringkasanReguler?.n_jam ? formatNum(ringkasanReguler.n_jam) : n_jam_reguler_formatted)));

  const displayPekanReguler = ringkasanReguler?.pekan !== undefined 
    ? ringkasanReguler.pekan 
    : (ringkasanUmptkin?.pekan !== undefined ? ringkasanUmptkin.pekan : 14);

  const displayCJamReguler = ringkasanReguler?.rincian_jam?.reguler?.c_jam !== undefined
    ? formatNum(ringkasanReguler.rincian_jam.reguler.c_jam)
    : (ringkasanUmptkin?.rincian_jam?.reguler?.c_jam !== undefined
        ? formatNum(ringkasanUmptkin.rincian_jam.reguler.c_jam)
        : (ringkasanReguler?.c_jam_reguler
            ? formatNum(ringkasanReguler.c_jam_reguler)
            : (ringkasanReguler?.a_akumulasi_jam 
                ? formatNum(ringkasanReguler.a_akumulasi_jam) 
                : (ringkasanReguler?.c_jam ? formatNum(ringkasanReguler.c_jam) : c_jam_reguler_formatted))));

  const displayNMenitReguler = ringkasanReguler?.rincian_jam?.reguler?.n_menit !== undefined
    ? ringkasanReguler.rincian_jam.reguler.n_menit
    : (ringkasanUmptkin?.rincian_jam?.reguler?.n_menit !== undefined
        ? ringkasanUmptkin.rincian_jam.reguler.n_menit
        : (ringkasanReguler?.n_menit_reguler ? ringkasanReguler.n_menit_reguler : (ringkasanReguler?.n_menit ? ringkasanReguler.n_menit : n_menit_reguler)));

  const displayCMenitReguler = ringkasanReguler?.rincian_jam?.reguler?.c_menit !== undefined
    ? ringkasanReguler.rincian_jam.reguler.c_menit
    : (ringkasanUmptkin?.rincian_jam?.reguler?.c_menit !== undefined
        ? ringkasanUmptkin.rincian_jam.reguler.c_menit
        : (ringkasanReguler?.c_menit_reguler ? ringkasanReguler.c_menit_reguler : (ringkasanReguler?.c_menit ? ringkasanReguler.c_menit : c_menit_reguler)));

  // UMPTKIN
  const displayNJamUmptkin = ringkasanUmptkin?.rincian_jam?.umptkin?.n_jam !== undefined
    ? formatNum(ringkasanUmptkin.rincian_jam.umptkin.n_jam)
    : (ringkasanUmptkin?.n_jam_umptkin
        ? formatNum(ringkasanUmptkin.n_jam_umptkin)
        : (ringkasanUmptkin?.n_jam ? formatNum(ringkasanUmptkin.n_jam) : n_jam_umptkin_formatted));

  const displayCJamUmptkin = ringkasanUmptkin?.rincian_jam?.umptkin?.c_jam !== undefined
    ? formatNum(ringkasanUmptkin.rincian_jam.umptkin.c_jam)
    : (ringkasanUmptkin?.c_jam_umptkin
        ? formatNum(ringkasanUmptkin.c_jam_umptkin)
        : (ringkasanUmptkin?.a_akumulasi_jam 
            ? formatNum(ringkasanUmptkin.a_akumulasi_jam) 
            : (ringkasanUmptkin?.c_jam ? formatNum(ringkasanUmptkin.c_jam) : c_jam_umptkin_formatted)));

  const displayNMenitUmptkin = ringkasanUmptkin?.rincian_jam?.umptkin?.n_menit !== undefined
    ? ringkasanUmptkin.rincian_jam.umptkin.n_menit
    : (ringkasanUmptkin?.n_menit_umptkin ? ringkasanUmptkin.n_menit_umptkin : (ringkasanUmptkin?.n_menit ? ringkasanUmptkin.n_menit : n_menit_umptkin));

  const displayCMenitUmptkin = ringkasanUmptkin?.rincian_jam?.umptkin?.c_menit !== undefined
    ? ringkasanUmptkin.rincian_jam.umptkin.c_menit
    : (ringkasanUmptkin?.c_menit_umptkin ? ringkasanUmptkin.c_menit_umptkin : (ringkasanUmptkin?.c_menit ? ringkasanUmptkin.c_menit : c_menit_umptkin));

  // Totals & Parse helper for dynamic calculations
  const parseVal = (strOrNum) => {
    if (strOrNum === undefined || strOrNum === null) return 0;
    if (typeof strOrNum === "number") return strOrNum;
    const clean = String(strOrNum).replace(",", ".");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const displayWaktuOperasional = (isModeCombined ? (ringkasanUmptkin?.jam_operasional_total ?? ringkasanReguler?.jam_operasional_total) : ringkasanReguler?.jam_operasional_total) !== undefined 
    ? (isModeCombined ? (ringkasanUmptkin?.jam_operasional_total ?? ringkasanReguler?.jam_operasional_total) : ringkasanReguler?.jam_operasional_total)
    : localWaktuOperasionalSemester;

  const regulerHours = parseVal(displayCJamReguler);
  const umptkinHours = isModeCombined ? parseVal(displayCJamUmptkin) : 0;
  const totalJamVal = isModeCombined && (ringkasanUmptkin?.a_akumulasi_jam || ringkasanUmptkin?.c_jam)
    ? (ringkasanUmptkin.a_akumulasi_jam || ringkasanUmptkin.c_jam)
    : (regulerHours + umptkinHours);

  const displayTotalJam = formatNum(totalJamVal);

  const displayTotalMenit = isModeCombined
    ? (ringkasanUmptkin?.c_menit !== undefined ? ringkasanUmptkin.c_menit : (Number(displayCMenitReguler) + Number(displayCMenitUmptkin)))
    : Number(displayCMenitReguler);

  const displayPersentaseFormatted = isModeCombined && ringkasanUmptkin?.persentase_formatted
    ? String(ringkasanUmptkin.persentase_formatted).replace("%", "").trim()
    : (isModeCombined && ringkasanUmptkin?.persentase !== undefined
        ? formatNum(ringkasanUmptkin.persentase)
        : formatNum((totalJamVal / displayWaktuOperasional) * 100));


  const getPlpNameAndNip = () => {
    const username = (userProfile?.user?.username || "").toLowerCase();
    const name = (userProfile?.user?.name || userProfile?.user?.nama || userProfile?.user?.username || "Ade Candra, S.Pd");
    
    if (username.includes("ahmad") || name.toLowerCase().includes("ahmad")) {
      return {
        name: "Ahmad M.Kom",
        nip: "198510242025211008"
      };
    }
    if (username.includes("yusuf") || name.toLowerCase().includes("yusuf")) {
      return {
        name: "Muhammad Yusuf S.Kom",
        nip: "197908182009101002"
      };
    }
    return {
      name: "Ade Candra, S.Pd",
      nip: "197205112009101002"
    };
  };

  const plpInfo = getPlpNameAndNip();

  const page1Schedules = labSchedules.filter(s => {
    if (!s) return false;
    const isUmPtkin = s.prodi === "UM PTKIN" || 
                      s.matkul === "UM PTKIN" || 
                      s.kelas === "UMPTKIN" ||
                      s.source === "um_ptkin";
    return !isUmPtkin && (s.hari === "Senin" || s.hari === "Selasa" || s.hari === "Rabu" || s.hari === "Kamis");
  });

  const page2Schedules = labSchedules.filter(s => {
    if (!s) return false;
    const isUmPtkin = s.prodi === "UM PTKIN" || 
                      s.matkul === "UM PTKIN" || 
                      s.kelas === "UMPTKIN" ||
                      s.source === "um_ptkin";
    return !isUmPtkin && (s.hari === "Jumat" || s.hari === "Sabtu" || s.hari === "Minggu");
  });

  const renderDynamicTableRows = (schedulesList, periodText) => {
    if (schedulesList.length === 0) {
      return (
        <tr className="border-b border-black">
          <td colSpan="6" className="border border-black px-3 py-4 text-center text-[9.5px] font-semibold text-slate-400">
            Tidak ada jadwal praktikum ({periodText})
          </td>
        </tr>
      );
    }

    // Group schedules by day to calculate rowSpan
    const dayCounts = {};
    schedulesList.forEach(s => {
      dayCounts[s.hari] = (dayCounts[s.hari] || 0) + 1;
    });

    const renderedDays = new Set();

    return schedulesList.map((s, idx) => {
      const isFirstForDay = !renderedDays.has(s.hari);
      renderedDays.add(s.hari);
      const daySpan = dayCounts[s.hari] || 1;

      return (
        <tr key={s.id || idx} className="border-b border-black text-black">
          {isFirstForDay && (
            <td 
              rowSpan={daySpan} 
              className="border border-black px-2 py-1 text-center font-bold text-[9.5px] bg-slate-50/50 print:bg-white text-black leading-tight w-[80px] align-middle"
            >
              {s.hari}
            </td>
          )}
          <td className="border border-black px-2 py-1 text-center font-semibold text-[9.5px] text-black leading-tight w-[120px] align-middle">
            {s.jam}
          </td>
          <td className="border border-black px-3 py-1 text-left text-[9.5px] font-medium text-black leading-tight align-middle">
            {s.matkul}
          </td>
          <td className="border border-black px-3 py-1 text-left text-[9.5px] font-medium text-black leading-tight align-middle">
            {s.dosen}
          </td>
          <td className="border border-black px-2 py-1 text-center text-[9.5px] font-medium text-black leading-tight w-[55px] align-middle">
            {s.prodi}
          </td>
          <td className="border border-black px-2 py-1 text-center text-[9.5px] font-medium text-black leading-tight w-[65px] align-middle font-semibold">
            {s.kelas}
          </td>
        </tr>
      );
    });
  };

  // RENDER ADMIN PANEL (Logged In state)
  return (
    <div className="flex flex-col lg:flex-row min-h-[85vh] bg-slate-50/30 rounded-3xl overflow-hidden border border-slate-100 print:border-none print:bg-white">
      
      {/* MOBILE HEADER */}
      <div className="lg:hidden bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: "#4b8fca" }}>
            <BarChart2 size={16} />
          </div>
          <span className="font-extrabold text-sm text-slate-800 font-display">Admin LogLab</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          className="p-2 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold"
        >
          Menu
        </button>
      </div>

      {/* SIDEBAR NAVIGATION */}
      <aside 
        className={`${
          isMobileMenuOpen ? "block" : "hidden"
        } lg:block w-full lg:w-64 bg-white border-r border-slate-100 p-6 flex flex-col justify-between print:hidden shrink-0`}
      >
        <div className="space-y-8">
          {/* Logo Header */}
          <div className="hidden lg:flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/10" style={{ backgroundColor: "#4b8fca" }}>
              <BarChart2 size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-800 font-display leading-tight">Admin Portal</h2>
              <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Log Book Lab</span>
            </div>
          </div>
          
          {userProfile?.user && (
            <div className="px-4 py-3 rounded-2xl bg-blue-50/40 border border-blue-100/50 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Petugas Aktif</span>
              <span className="text-xs font-extrabold text-slate-800 font-display truncate">
                {userProfile.user.username}
              </span>
              <span className="text-[9px] font-extrabold text-blue-600 bg-blue-100/50 px-2 py-0.5 rounded-md inline-block w-max uppercase tracking-wider mt-1">
                Role: {userProfile.user.role}
              </span>
            </div>
          )}

          {/* Realtime Status Indicator */}
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: socketConnected ? '#22c55e' : '#ef4444',
              display: 'inline-block',
              boxShadow: socketConnected 
                ? '0 0 6px rgba(34, 197, 94, 0.6)' 
                : '0 0 6px rgba(239, 68, 68, 0.6)',
              animation: socketConnected ? 'pulse-green 2s infinite' : 'none',
            }} />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {socketConnected ? 'Realtime Aktif' : 'Offline'}
            </span>
          </div>

          {/* Menus */}
          <nav className="space-y-1.5">
            <button
              onClick={() => { setActiveTab("dashboard"); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === "dashboard"
                  ? "text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
              style={{ backgroundColor: activeTab === "dashboard" ? "#4b8fca" : "transparent" }}
            >
              <LayoutDashboard size={16} />
              Dashboard
            </button>

            <button
              onClick={() => { setActiveTab("data-penggunaan"); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === "data-penggunaan"
                  ? "text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
              style={{ backgroundColor: activeTab === "data-penggunaan" ? "#4b8fca" : "transparent" }}
            >
              <FileText size={16} />
              Data Penggunaan
            </button>

             <button
              onClick={() => { setActiveTab("laporan"); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === "laporan"
                  ? "text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
              style={{ backgroundColor: activeTab === "laporan" ? "#4b8fca" : "transparent" }}
            >
              <BarChart2 size={16} />
              Laporan
            </button>

            <button
              onClick={() => { setActiveTab("analisis-lab"); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === "analisis-lab"
                  ? "text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
              style={{ backgroundColor: activeTab === "analisis-lab" ? "#4b8fca" : "transparent" }}
            >
              <TrendingUp size={16} />
              Analisis Penggunaan
            </button>

            <button
              onClick={() => { setActiveTab("buat-jadwal"); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === "buat-jadwal"
                  ? "text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
              style={{ backgroundColor: activeTab === "buat-jadwal" ? "#4b8fca" : "transparent" }}
            >
              <Plus size={16} />
              Buat Jadwal Kuliah
            </button>
          </nav>
        </div>

        {/* Logout Button */}
        <div className="mt-8 space-y-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3.5 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <LogOut size={16} />
            Keluar (Logout)
          </button>
        </div>

        {/* Inline animation for realtime indicator pulse */}
        <style>{`
          @keyframes pulse-green {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </aside>

      {/* CONTENT AREA */}
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto print:p-0">
        
        {/* ==================== TAB: DASHBOARD ==================== */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 print:hidden">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 font-display">Dashboard Admin</h1>
              <p className="text-xs text-slate-500 mt-1">Gambaran umum log penggunaan laboratorium terbaru.</p>
            </div>

            {/* Statistik Ringkas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Stat 1 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: "#4b8fca" }}>
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Penggunaan</p>
                  <h3 className="text-xl font-bold text-slate-800 font-display mt-0.5">{totalUsage}</h3>
                </div>
              </div>

              {/* Stat 2 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: "#4bc9bf" }}>
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hari Ini</p>
                  <h3 className="text-xl font-bold text-slate-800 font-display mt-0.5">{usageToday}</h3>
                </div>
              </div>

              {/* Stat 3 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: "#5ea6d6" }}>
                  <Calendar size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Minggu Ini</p>
                  <h3 className="text-xl font-bold text-slate-800 font-display mt-0.5">{usageThisWeek}</h3>
                </div>
              </div>

              {/* Stat 4 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: "#4b8fca" }}>
                  <Award size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bulan Ini</p>
                  <h3 className="text-xl font-bold text-slate-800 font-display mt-0.5">{usageThisMonth}</h3>
                </div>
              </div>
            </div>

            {/* Aktivitas Terbaru */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 font-display">Aktivitas Terbaru</h2>
                <p className="text-[11px] text-slate-400 font-medium">Penggunaan laboratorium teranyar yang tercatat di sistem.</p>
              </div>

              <div className="divide-y divide-slate-100">
                {recentUsage.length > 0 ? (
                  recentUsage.map((log) => (
                    <div key={log.id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#4bc9bf" }}></div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            {log.dosen} <span className="text-slate-400 font-normal">menggunakan</span> {log.ruang}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                            Matkul: {log.matkul} | Kelas: {log.kelas} | P.J. Mhs: {log.mahasiswa || "-"}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-slate-50 text-slate-400 px-2 py-1 rounded font-bold uppercase">
                        {log.hari}, {log.jam}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-slate-400 font-semibold">Belum ada aktivitas penggunaan laboratorium.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB: DATA PENGGUNAAN ==================== */}
        {activeTab === "data-penggunaan" && (
          <div className="space-y-6 print:hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-800 font-display">Data Penggunaan Laboratorium</h1>
                <p className="text-xs text-slate-500 mt-1">Daftar lengkap seluruh log pencatatan penggunaan laboratorium.</p>
              </div>
            </div>

            {/* Statistik Ringkas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Stat 1: Total */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Jadwal</p>
                  <h3 className="text-lg font-bold text-slate-800 font-display mt-0.5">{mySchedules.length}</h3>
                </div>
              </div>

              {/* Stat 2: Dipesan */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-600">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Sedang Ada Kegiatan Berlangsung</p>
                  <h3 className="text-lg font-bold text-slate-800 font-display mt-0.5">
                    {mySchedules.filter(s => s.status === "dipesan" || s.status === "diterima").length}
                  </h3>
                </div>
              </div>

              {/* Stat 3: Kosong */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600">
                  <CheckCircle size={18} />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Kosong (Tersedia)</p>
                  <h3 className="text-lg font-bold text-slate-800 font-display mt-0.5">
                    {mySchedules.filter(s => s.status === "kosong").length}
                  </h3>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 flex-1 w-full">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Cari Dosen, Matkul, Mhs, NIM..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter size={12} className="text-slate-400 shrink-0" />
                  <select
                    value={filterHari}
                    onChange={(e) => {
                      setFilterHari(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white cursor-pointer"
                  >
                    <option value="">Semua Hari</option>
                    {listHari.map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <select
                  value={filterProdi}
                  onChange={(e) => {
                    setFilterProdi(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white cursor-pointer"
                >
                  <option value="">Semua Prodi</option>
                  {listProdi.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white cursor-pointer"
                >
                  <option value="">Semua Status</option>
                  <option value="dipesan">Sedang Berlangsung</option>
                  <option value="selesai">Sesi Berakhir</option>
                  <option value="kosong">Kosong (Tersedia)</option>
                </select>

                <select
                  value={filterSource}
                  onChange={(e) => {
                    setFilterSource(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white cursor-pointer"
                >
                  <option value="">Semua Sumber</option>
                  <option value="manual">Manual</option>
                  <option value="import">Import Excel</option>
                  <option value="um_ptkin">UM PTKIN</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left border-collapse text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={currentItems.length > 0 && currentItems.every(item => selectedLogIds.includes(item.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const pageIds = currentItems.map(item => item.id);
                              setSelectedLogIds(prev => [...new Set([...prev, ...pageIds])]);
                            } else {
                              const pageIds = currentItems.map(item => item.id);
                              setSelectedLogIds(prev => prev.filter(id => !pageIds.includes(id)));
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-4">Waktu & Ruang</th>
                      <th className="px-6 py-4">Dosen & Perkuliahan</th>
                      <th className="px-6 py-4">Mahasiswa (P.J.) & NIM</th>
                      <th className="px-6 py-4">Kontak & Kehadiran</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentItems.length > 0 ? (
                      currentItems.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedLogIds.includes(log.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLogIds(prev => [...prev, log.id]);
                                } else {
                                  setSelectedLogIds(prev => prev.filter(id => id !== log.id));
                                }
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">{log.hari}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Clock size={10} className="text-slate-400" />
                              {log.jam}
                            </div>
                            <div className="text-[12px] text-blue-600 font-bold mt-1 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 inline-block">
                              {log.ruang}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800 text-sm">{log.dosen}</div>
                            <div className="text-[11px] text-slate-600 mt-0.5 font-medium">{log.matkul}</div>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 text-slate-500 rounded text-[12px] font-bold">
                                {log.prodi}
                              </span>
                              <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded text-[12px] font-mono font-bold">
                                {log.kelas}
                              </span>
                              {log.source && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                                  log.source === "um_ptkin"
                                    ? "bg-amber-50 border border-amber-200 text-amber-700"
                                    : log.source === "import" || log.is_auto === 1
                                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                    : "bg-blue-50 border border-blue-200 text-blue-700"
                                }`}>
                                  {log.source === "um_ptkin" ? "UM PTKIN" : (log.source === "import" || log.is_auto === 1) ? "XLSX" : "Manual"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">{log.mahasiswa || "-"}</div>
                            <div className="text-[18px] text-slate-400 font-mono mt-0.5">{log.nim || "-"}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-slate-700">{log.numberwa || "-"}</span>
                              {log.numberwa && (
                                <a
                                  href={`https://wa.me/${formatWhatsAppNumber(log.numberwa)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-500 hover:text-emerald-600 p-0.5 hover:bg-emerald-50 rounded transition"
                                  title="Hubungi via WhatsApp"
                              
                                >
                                  <MessageCircle size={14} />
                                </a>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                              <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded text-[10px] font-bold">
                                {log.jumlahHadir || 0} Orang
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {log.status === "selesai" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 rounded-full text-[10px] font-bold">
                                <XCircle size={11} className="text-red-500" /> Sesi Berakhir
                              </span>
                            ) : log.status === "dipesan" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-[10px] font-bold">
                                <AlertCircle size={11} /> Sedang Ada Kegiatan Berlangsung
                              </span>
                            ) : log.status === "diterima" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-bold">
                                <CheckCircle size={11} /> Terjadwal (Sudah Di Setujui)
                              </span>
                            ) : log.status === "ditolak" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 rounded-full text-[10px] font-bold">
                                <XCircle size={11} /> Ditolak
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-bold">
                                <CheckCircle size={11} /> Kosong (Tersedia)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              <button
                                onClick={() => setSelectedLog(log)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Detail Data"
                              >
                                <Info size={14} />
                              </button>
                              <button
                                onClick={() => openEditModal(log)}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                title="Edit Data"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleAddToHistory(log)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Tambahkan ke History"
                              >
                                <History size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Hapus Data"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-semibold">
                          Tidak ada data penggunaan ditemukan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/50">
                  <span className="text-xs text-slate-500">
                    Menampilkan <strong className="font-semibold text-slate-700">{indexOfFirstItem + 1}</strong> - <strong className="font-semibold text-slate-700">{Math.min(indexOfLastItem, filteredUsage.length)}</strong> dari <strong className="font-semibold text-slate-700">{filteredUsage.length}</strong> data
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition cursor-pointer"
                    >
                      Sebelumnya
                    </button>
                    {[...Array(totalPages)].map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPage(idx + 1)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                          currentPage === idx + 1
                            ? "text-white shadow-xs"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                        style={{ backgroundColor: currentPage === idx + 1 ? "#4b8fca" : "transparent" }}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition cursor-pointer"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bulk Action Sticky Bar */}
            {selectedLogIds.length > 0 && (
              <div className="fixed bottom-6 left-6 right-6 lg:left-72 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 z-45 animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold font-mono">
                    {selectedLogIds.length}
                  </span>
                  <span className="text-xs font-bold text-slate-700 font-display">Data Penggunaan Terpilih</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition duration-200 cursor-pointer shadow-xs"
                  >
                    <Trash2 size={14} />
                    Hapus Terpilih
                  </button>
                  {(userProfile?.user?.role === "admin" || userProfile?.akses_semua_lab === true) && (
                    <button
                      onClick={handleClearAllData}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition duration-200 cursor-pointer shadow-xs"
                      title="Kosongkan seluruh data logbook dan jadwal kuliah"
                    >
                      <Trash2 size={14} />
                      Hapus Semua Data
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedLogIds([])}
                    className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition duration-200 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB: LAPORAN ==================== */}
        {activeTab === "laporan" && (
          <div className="space-y-6">
            <div className="print:hidden">
              <h1 className="text-2xl font-extrabold text-slate-800 font-display">Laporan Log Book Laboratorium</h1>
              <p className="text-xs text-slate-500 mt-1">Cetak laporan data atau ekspor data ke format spreadsheet Excel.</p>
            </div>

            {/* Filter Date Range & Type (Hidden in print layout) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4 print:hidden">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filter Laporan</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Jenis Laporan (Periode)</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white cursor-pointer"
                  >
                    <option value="semua">Semua Periode (Kustom)</option>
                    <option value="harian">Jadwal Harian (Hari Ini)</option>
                    <option value="semester1">Semester 1 / Ganjil (Agt - Jan)</option>
                    <option value="semester2">Semester 2 / Genap (Feb - Agt)</option>
                    <option value="bulanan">Berdasarkan Bulan</option>
                  </select>
                </div>

                {reportType === "bulanan" ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pilih Bulan</label>
                    <select
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white cursor-pointer"
                    >
                      <option value="">Semua Bulan</option>
                      <option value="1">Januari</option>
                      <option value="2">Februari</option>
                      <option value="3">Maret</option>
                      <option value="4">April</option>
                      <option value="5">Mei</option>
                      <option value="6">Juni</option>
                      <option value="7">Juli</option>
                      <option value="8">Agustus</option>
                      <option value="9">September</option>
                      <option value="10">Oktober</option>
                      <option value="11">November</option>
                      <option value="12">Desember</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tanggal Mulai (Kustom)</label>
                    <input
                      type="date"
                      disabled={reportType !== "semua"}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-50"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status Pesanan</label>
                  <select
                    value={reportStatus}
                    onChange={(e) => setReportStatus(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white cursor-pointer"
                  >
                    <option value="semua">Semua Status</option>
                    <option value="terpakai">Terpakai (Ada Logbook)</option>
                    <option value="tidak terpakai">Tidak Terpakai / Kosong</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tahun Akademik</label>
                  <select
                    value={reportYear}
                    onChange={(e) => setReportYear(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white cursor-pointer"
                  >
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap gap-2 pt-2 justify-end">
                <button
                  onClick={exportExcel}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  Ekspor Excel
                </button>
                
                <button
                  onClick={printReport}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md"
                  style={{ backgroundColor: "#db1b1b" }}
                >
                  <Printer size={14} />
                  Cetak Laporan PDF
                </button>
              </div>
            </div>

            {/* Print Document Header (Visible only in print layout) */}
            <div className="hidden print:block text-center border-b-2 border-slate-900 pb-5 mb-6">
              <h1 className="text-xl font-bold text-slate-950 font-display">LAPORAN LOG BOOK PENGGUNAAN LABORATORIUM</h1>
              <p className="text-xs text-slate-600 mt-1.5">
                Periode: {reportType === "harian" ? "Harian (Hari Ini)" : reportType === "semester" ? "Semester (6 Bulan Terakhir)" : `Kustom (${startDate || "Awal"} s.d. ${endDate || "Sekarang"})`} | Status: {reportStatus === "terpakai" ? "Terpakai" : reportStatus === "tidak terpakai" ? "Tidak Terpakai" : "Semua Status"}
              </p>
            </div>

            {/* Report Table */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs print:border-none print:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left border-collapse text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px] print:bg-white print:border-b-2 print:border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Tanggal Input</th>
                      <th className="px-6 py-4">Waktu & Ruang</th>
                      <th className="px-6 py-4">Dosen & Perkuliahan</th>
                      <th className="px-6 py-4">Mahasiswa (P.J.) & NIM</th>
                      <th className="px-6 py-4">Kontak & Kehadiran</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportFilteredUsage.length > 0 ? (
                      reportFilteredUsage.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition print:break-inside-avoid">
                          <td className="px-6 py-4 font-medium text-slate-700">{log.tanggalInput}</td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">{log.hari}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{log.jam}</div>
                            <div className="text-[10px] text-blue-600 font-semibold mt-1">{log.ruang}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800">{log.dosen}</div>
                            <div className="text-[10px] text-slate-600 mt-0.5">{log.matkul}</div>
                            <div className="text-[9px] text-slate-400 mt-1">{log.prodi} | Kelas {log.kelas}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800">
                              {log.status === "tidak terpakai" ? "BELUM DIPESAN" : (log.mahasiswa || "-")}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {log.status === "tidak terpakai" ? "-" : (log.nim || "-")}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-slate-700">
                              {log.status === "tidak terpakai" ? "-" : (log.numberwa || "-")}
                            </div>
                            <div className={`text-[9px] font-bold mt-1 ${log.status === "tidak terpakai" ? "text-slate-400" : "text-emerald-600"}`}>
                              {log.status === "tidak terpakai" ? "-" : `${log.jumlahHadir || 0} Orang`}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {log.status === "tidak terpakai" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-[10px] font-bold">
                                <XCircle size={11} className="text-amber-500" /> BELUM DIPESAN
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-bold">
                                <CheckCircle size={11} /> DIPESAN
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-semibold">
                          Tidak ada data log book pada rentang tanggal tersebut.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB: ANALISIS PENGGUNAAN LAB ==================== */}
        {activeTab === "analisis-lab" && (
          <div className="space-y-6">
            <style dangerouslySetInnerHTML={{__html: `
              @media screen {
                .a4-page-preview {
                  width: 210mm;
                  min-height: 297mm;
                  padding: 15mm;
                  margin: 20px auto;
                  border: 1px solid #e2e8f0;
                  background-color: white;
                  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                }
              }
              @media print {
                aside, nav, header, .print-hidden-panel, .lg\\:hidden, button, select, input, .alert-api-info {
                  display: none !important;
                }
                body, html, #root {
                  background-color: white !important;
                  color: black !important;
                  width: 100% !important;
                  height: auto !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .a4-page-preview {
                  width: 100% !important;
                  min-height: auto !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: transparent !important;
                  page-break-after: always !important;
                }
                .a4-page-preview:last-child {
                  page-break-after: avoid !important;
                }
                @page {
                  size: A4;
                  margin: 15mm;
                }
              }
            `}} />

            {/* SCREEN-ONLY CONTROLS & ALERTS */}
            <div className="print:hidden space-y-6">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-800 font-display">Analisis Penggunaan & Laporan PDF</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Pilih laboratorium untuk menarik data statistik secara real-time langsung dari backend dan cetak dokumen laporan resmi.
                </p>
              </div>

              {/* Alert API Status */}
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 rounded-2xl text-xs space-y-2 alert-api-info">
                <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <CheckCircle size={16} />
                  Sinkronisasi API Berhasil:
                </p>
                <p>
                  Tabel <strong>"2.1. Kegiatan Praktikum"</strong> di bawah ini terisi secara dinamis menggunakan data riil jadwal yang ditarik secara real-time langsung dari endpoint backend <code>GET /get/jadwal</code>.
                </p>
              </div>

              {/* Lab Selector & Print Trigger */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center gap-4 justify-between">
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Pilih Lab:</span>
                    <select
                      value={selectedLabId}
                      onChange={(e) => setSelectedLabId(e.target.value)}
                      className="w-full md:w-64 px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 cursor-pointer font-semibold text-slate-800"
                    >
                      {labPercentages.map(lab => (
                        <option key={lab.id_lab} value={lab.id_lab}>{lab.nama_lab}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                    <input
                      type="checkbox"
                      id="persentaseOnlyAutoCheck"
                      checked={!persentaseOnlyAuto}
                      onChange={(e) => setPersentaseOnlyAuto(!e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="persentaseOnlyAutoCheck" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Hitung Semua Jadwal (XLSX + Manual)
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Periode:</span>
                    
                    {/* Dropdown Semester */}
                    <select
                      value={analisisSemester}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnalisisSemester(val);
                        const semLabel = val === "1"
                          ? `Semester 1 / Ganjil (Agt ${analisisYear} - Jan ${parseInt(analisisYear) + 1})`
                          : `Semester 2 / Genap (Feb ${analisisYear} - Agt ${analisisYear})`;
                        setPeriodeSemester(semLabel);
                      }}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-semibold text-slate-800 bg-white cursor-pointer"
                    >
                      <option value="1">Semester 1 (Agt - Jan)</option>
                      <option value="2">Semester 2 (Feb - Agt)</option>
                    </select>

                    {/* Dropdown Tahun */}
                    <select
                      value={analisisYear}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnalisisYear(val);
                        const semLabel = analisisSemester === "1"
                          ? `Semester 1 / Ganjil (Agt ${val} - Jan ${parseInt(val) + 1})`
                          : `Semester 2 / Genap (Feb ${val} - Agt ${val})`;
                        setPeriodeSemester(semLabel);
                      }}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-semibold text-slate-800 bg-white cursor-pointer"
                    >
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                      <option value="2028">2028</option>
                    </select>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="w-full md:w-auto px-5 py-2.5 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: "#db1b1b" }}
                  >
                    <Printer size={15} />
                    Cetak Laporan PDF
                  </button>
                </div>
              </div>
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="overflow-auto max-w-full">
              <div className="print-only-container">
                {/* HALAMAN 1 */}
                <div className="a4-page-preview text-black font-sans leading-normal relative select-text">
                  {/* Header Table */}
                  <table className="w-full border-collapse border border-black mb-6 text-black">
                    <tbody>
                      <tr>
                        <td className="border border-black p-3 w-[70%]">
                          <div className="flex items-center gap-4">
                            <img src={uinLogo} alt="Logo UIN" className="w-14 h-14 object-contain" />
                            <div className="text-left font-serif leading-tight text-black">
                              <h1 className="text-xs font-extrabold text-black uppercase tracking-wide">Pusat Laboratorium Terpadu</h1>
                              <h2 className="text-[11px] font-extrabold text-black uppercase tracking-wide">Fakultas Sains dan Teknologi</h2>
                              <h3 className="text-[11px] font-extrabold text-black uppercase tracking-wide">UIN Jakarta</h3>
                              <p className="text-[8px] text-black font-medium mt-0.5">Jl. Ir. H. Juanda No. 95 Ciputat 15412 Indonesia</p>
                            </div>
                          </div>
                        </td>
                        <td className="border border-black p-3 w-[30%] text-[9px] leading-relaxed text-black font-bold align-middle">
                          <div>No. Dok: FORM-PST-PLT-006</div>
                          <div>Tgl. Terbit: 1 Oktober 2018</div>
                          <div>No. Revisi: 0</div>
                          <div>Hal: 1 / 2</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Title */}
                  <div className="text-center mb-6">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-black underline mb-1">
                      LAPORAN KEGIATAN PENGELOLAAN LABORATORIUM
                    </h2>
                    <h3 className="text-[10px] font-bold uppercase text-black max-w-xl mx-auto leading-relaxed">
                      LAPORAN PENGGUNAAN LABORATORIUM DIBANDINGKAN TOTAL WAKTU OPERASIONAL YANG TERSEDIA <br />
                      {activeLabObject.nama_lab || "Laboratorium Digital"} <br />
                      PERIODE: {periodeSemester}
                    </h3>
                  </div>

                  {/* Section 1 */}
                  <div className="space-y-2 mb-6 text-black">
                    <h4 className="text-xs font-bold text-black">1. Waktu Operasional Laboratorium</h4>
                    <ul className="list-disc pl-5 text-[10.5px] leading-relaxed text-black font-medium">
                      <li>Senin s.d. Jumat: 8 jam per hari</li>
                      <li>Total hari operasional per pekan: 5 hari</li>
                      <li>Total pekan dalam satu semester: 14 pekan</li>
                      <li>Total waktu operasional {activeLabObject.nama_lab || "Laboratorium Digital"} selama satu semester: 560 jam</li>
                    </ul>
                  </div>

                  {/* Section 2 */}
                  <div className="space-y-3 text-black">
                    <h4 className="text-xs font-bold text-black">2. Penggunaan Laboratorium</h4>
                    <h5 className="text-[11px] font-bold text-black pl-2">2.1. Kegiatan Praktikum di {activeLabObject.nama_lab || "Laboratorium Digital"}</h5>
                    
                    {/* Table Page 1 (Senin s.d. Kamis) */}
                    <table className="w-full border-collapse border border-black text-black">
                      <thead className="bg-yellow-400">
                        <tr className="border border-black">
                          <th className="border border-black px-2 py-1 text-center text-[10px] font-extrabold text-black w-[80px]">Hari</th>
                          <th className="border border-black px-2 py-1 text-center text-[10px] font-extrabold text-black w-[120px]">Jam</th>
                          <th className="border border-black px-3 py-1 text-center text-[10px] font-extrabold text-black">Mata Kuliah</th>
                          <th className="border border-black px-3 py-1 text-center text-[10px] font-extrabold text-black">Nama Dosen</th>
                          <th className="border border-black px-2 py-1 text-center text-[10px] font-extrabold text-black w-[55px]">Prodi</th>
                          <th className="border border-black px-2 py-1 text-center text-[10px] font-extrabold text-black w-[65px]">Kelas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {renderDynamicTableRows(page1Schedules, "Senin s.d. Kamis")}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* HALAMAN 2 */}
                <div className="a4-page-preview text-black font-sans leading-normal relative select-text print:break-before-page">
                  {/* Header Table Page 2 */}
                  <table className="w-full border-collapse border border-black mb-6 text-black">
                    <tbody>
                      <tr>
                        <td className="border border-black p-3 w-[70%]">
                          <div className="flex items-center gap-4">
                            <img src={uinLogo} alt="Logo UIN" className="w-14 h-14 object-contain" />
                            <div className="text-left font-serif leading-tight text-black">
                              <h1 className="text-xs font-extrabold text-black uppercase tracking-wide">Pusat Laboratorium Terpadu</h1>
                              <h2 className="text-[11px] font-extrabold text-black uppercase tracking-wide">Fakultas Sains dan Teknologi</h2>
                              <h3 className="text-[11px] font-extrabold text-black uppercase tracking-wide">UIN Jakarta</h3>
                              <p className="text-[8px] text-black font-medium mt-0.5">Jl. Ir. H. Juanda No. 95 Ciputat 15412 Indonesia</p>
                            </div>
                          </div>
                        </td>
                        <td className="border border-black p-3 w-[30%] text-[9px] leading-relaxed text-black font-bold align-middle">
                          <div>No. Dok: FORM-PST-PLT-006</div>
                          <div>Tgl. Terbit: 1 Oktober 2018</div>
                          <div>No. Revisi: 0</div>
                          <div>Hal: 2 / 2</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Table Page 2 (Jumat) */}
                  <div className="space-y-4 text-black mb-6">
                    <table className="w-full border-collapse border border-black text-black">
                      <thead className="bg-yellow-400">
                        <tr className="border border-black">
                          <th className="border border-black px-2 py-1 text-center text-[10px] font-extrabold text-black w-[80px]">Hari</th>
                          <th className="border border-black px-2 py-1 text-center text-[10px] font-extrabold text-black w-[120px]">Jam</th>
                          <th className="border border-black px-3 py-1 text-center text-[10px] font-extrabold text-black">Mata Kuliah</th>
                          <th className="border border-black px-3 py-1 text-center text-[10px] font-extrabold text-black">Nama Dosen</th>
                          <th className="border border-black px-2 py-1 text-center text-[10px] font-extrabold text-black w-[55px]">Prodi</th>
                          <th className="border border-black px-2 py-1 text-center text-[10px] font-extrabold text-black w-[65px]">Kelas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {renderDynamicTableRows(page2Schedules, "Jumat s.d. Minggu")}
                      </tbody>
                    </table>

                    {/* Math calculations description */}
                    <div className="pt-2 text-[10.5px] leading-relaxed text-black font-medium space-y-1">
                      <p className="font-bold">Waktu penggunaan laboratorium</p>
                      
                      {isModeCombined ? (
                        <>
                          <p>
                            Kegiatan praktikum reguler: {displayNJamReguler} jam/pekan x {displayPekanReguler} pekan = {displayCJamReguler} jam
                          </p>
                          <p className="text-[9.5px] text-slate-500 font-sans">
                            (Rincian menit: {displayNMenitReguler} menit/pekan x {displayPekanReguler} pekan = {displayCMenitReguler} menit = {displayCJamReguler} jam)
                          </p>
                          <p className="mt-1">
                            Kegiatan Ujian UMPTKIN: {displayNJamUmptkin} jam/pekan x 1 pekan = {displayCJamUmptkin} jam
                          </p>
                          <p className="text-[9.5px] text-slate-500 font-sans">
                            (Rincian menit: {displayNMenitUmptkin} menit/pekan x 1 pekan = {displayCMenitUmptkin} menit = {displayCJamUmptkin} jam)
                          </p>
                        </>
                      ) : (
                        <>
                          <p>
                            Kegiatan praktikum: {displayNJamReguler} jam/pekan x {displayPekanReguler} pekan = {displayCJamReguler} jam
                          </p>
                          <p className="text-[9.5px] text-slate-500 font-sans">
                            (Rincian menit: {displayNMenitReguler} menit/pekan x {displayPekanReguler} pekan = {displayCMenitReguler} menit = {displayCJamReguler} jam)
                          </p>
                        </>
                      )}

                      <p className="font-bold uppercase tracking-wider pt-1">
                        TOTAL : {displayTotalJam} JAM
                      </p>
                    </div>
                  </div>

                  {/* Section 3 */}
                  <div className="space-y-2 mb-10 text-black">
                    <h4 className="text-xs font-bold text-black">3. ANALISIS</h4>
                    <div className="text-[10.5px] leading-relaxed text-black pl-2 font-medium">
                      <p className="mb-2">Persentase penggunaan laboratorium terhadap total waktu operasional selama satu semester:</p>
                      <p className="font-bold bg-slate-50 border border-slate-100 p-2.5 rounded-lg inline-block text-[11px] text-slate-800 print:bg-white print:border-none print:p-0">
                        {displayTotalJam} jam / {displayWaktuOperasional} jam x 100% = {displayPersentaseFormatted} %
                      </p>

                      {isModeCombined && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-900 font-medium max-w-2xl leading-relaxed print:bg-white print:border-none print:p-0 print:mt-2">
                          <p className="font-bold flex items-center gap-1 mb-0.5 text-amber-950">
                            📝 Catatan Analisis:
                          </p>
                          <p className="m-0">
                            Hasil persentase penggunaan mencakup gabungan <strong>kegiatan praktikum reguler + Ujian UMPTKIN</strong>. Selama pelaksanaan ujian tersebut, laboratorium digunakan secara penuh, sehingga rasio pemakaian ruang meningkat.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Signature block */}
                  <div className="text-right text-[10.5px] text-black pr-4 space-y-12">
                    <div className="font-medium text-black">
                      Jakarta, {getIndonesianDateString()}
                    </div>

                    <div className="grid grid-cols-2 text-center text-black leading-relaxed font-semibold">
                      <div>
                        <p>Mengetahui,</p>
                        <p className="mb-14">Kepala PLT</p>
                        <p className="underline font-bold">Dr. Iwan Aminudin, S.Hut., M.Si</p>
                        <p className="font-medium text-[9.5px]">NIP. 19700209 201411 1 001</p>
                      </div>
                      <div>
                        <p className="invisible">Jakarta,</p>
                        <p className="mb-14">PLP,</p>
                        <p className="underline font-bold">{plpInfo.name}</p>
                        <p className="font-medium text-[9.5px]">NIP. {plpInfo.nip}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB: BUAT JADWAL KULIAH ==================== */}
        {activeTab === "buat-jadwal" && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 font-display">Buat Jadwal Kuliah</h1>
              <p className="text-xs text-slate-500 mt-1">
                Tambahkan jadwal perkuliahan massal melalui impor file atau isi form entri manual di bawah ini.
              </p>
            </div>

            {/* Grid Layout for Import & Manual Entry */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT PANEL: IMPORT MASSAL (lg:col-span-5) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden p-6 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-800 font-display">Import Jadwal Otomatis (Excel/CSV)</h3>
                      <p className="text-[10px] text-slate-400">Impor banyak jadwal sekaligus secara otomatis</p>
                    </div>
                  </div>

                  {/* Template Download Link */}
                  <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between gap-3 border border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold text-slate-700 block">Belum punya format?</span>
                      <span className="text-[9px] text-slate-400 block">Gunakan template resmi kami</span>
                    </div>
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                    >
                      <FileDown size={12} />
                      Unduh Template
                    </button>
                  </div>

                  {/* Import Configuration (Starting Date & Default Lab) */}
                  <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-700 block">Pengaturan Impor Jadwal</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Tanggal Awal Minggu (Senin)
                        </label>
                        <input
                          type="date"
                          value={importWeekStartDate}
                          onChange={(e) => setImportWeekStartDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-xs bg-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Default Lab (Jika tidak di berkas)
                        </label>
                        <select
                          value={importDefaultLab}
                          onChange={(e) => setImportDefaultLab(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-xs bg-white"
                        >
                          <option value="">-- Pilih Laboratorium --</option>
                          {filteredLaboratories.map((lab) => (
                            <option key={lab.id} value={lab.name}>
                              {lab.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      if (!importWeekStartDate || !importDefaultLab) return;
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      if (!importWeekStartDate || !importDefaultLab) return;
                      e.preventDefault();
                      setIsDragOver(false);
                      handleFileUpload(e);
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center gap-2.5 relative ${
                      (!importWeekStartDate || !importDefaultLab) 
                        ? "border-slate-200 bg-slate-50/50 opacity-60 cursor-not-allowed"
                        : isDragOver 
                          ? "border-blue-500 bg-blue-50/20 cursor-pointer" 
                          : "border-slate-200 hover:border-slate-300 bg-slate-50/20 cursor-pointer"
                    }`}
                  >
                    <input
                      type="file"
                      disabled={!importWeekStartDate || !importDefaultLab}
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileUpload}
                      className={`absolute inset-0 opacity-0 w-full h-full ${
                        (!importWeekStartDate || !importDefaultLab) ? "cursor-not-allowed" : "cursor-pointer"
                      }`}
                    />
                    <div className={`p-3 rounded-2xl ${
                      (!importWeekStartDate || !importDefaultLab) ? "bg-slate-200 text-slate-400" : "bg-blue-50 text-blue-600"
                    }`}>
                      <Upload size={22} />
                    </div>
                    <div className="space-y-1">
                      <span className={`text-xs font-bold block ${
                        (!importWeekStartDate || !importDefaultLab) ? "text-slate-400" : "text-slate-700"
                      }`}>
                        {importFileName ? importFileName : "Pilih file Excel / CSV"}
                      </span>
                      <span className="text-[9px] text-slate-400 block font-medium">
                        {(!importWeekStartDate || !importDefaultLab)
                          ? "⚠️ Lengkapi Tanggal Awal & Default Lab di atas terlebih dahulu"
                          : "Drag & drop berkas Anda di sini, atau klik untuk mencari"
                        }
                      </span>
                    </div>
                  </div>

                  {/* Import Error Message */}
                  {importError && (
                    <div className="p-3.5 bg-red-50 text-red-700 rounded-2xl text-[10px] font-semibold border-l-4 border-red-500">
                      {importError}
                    </div>
                  )}

                  {/* Preview Section */}
                  {importedSchedules.length > 0 && (
                    <div className="space-y-3.5 pt-3 border-t border-slate-100">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400">Total Baris Dideteksi:</span>
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {importedSchedules.length} Jadwal
                        </span>
                      </div>

                      {/* Small preview table */}
                      <div className="border border-slate-100 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                        <table className="w-full text-left text-[9px] text-slate-500 border-collapse">
                          <thead className="bg-slate-50 text-slate-400 font-bold sticky top-0 border-b border-slate-100">
                            <tr>
                              <th className="p-2">Hari/Tgl</th>
                              <th className="p-2">Matkul</th>
                              <th className="p-2">Ruang</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {importedSchedules.map((s, idx) => {
                              const jamMulai = s.jam.split("-")[0]?.trim() || "08:00";
                              const jamSelesai = s.jam.split("-")[1]?.trim() || "10:00";
                              const normalizedJam = `${jamMulai} - ${jamSelesai}`.replace(/\s+/g, '');

                              const isDuplicate = mySchedules.some(item => 
                                item.ruang?.toLowerCase() === s.ruang?.toLowerCase() &&
                                item.tanggalInput === s.tanggalInput &&
                                item.jam?.replace(/\s+/g, '') === normalizedJam
                              );

                              return (
                                <tr key={idx} className={`hover:bg-slate-50 ${isDuplicate ? 'bg-amber-50/50 hover:bg-amber-100/50' : ''}`}>
                                  <td className="p-2 font-medium flex items-center gap-1">
                                    {isDuplicate && <AlertCircle size={10} className="text-amber-500 shrink-0" />}
                                    <span>{s.hari}, {s.tanggalInput}</span>
                                  </td>
                                  <td className="p-2 truncate max-w-[100px]" title={s.matkul}>
                                    {s.matkul}
                                  </td>
                                  <td className={`p-2 truncate max-w-[80px] ${isDuplicate ? 'text-amber-700 font-bold' : ''}`} title={s.ruang}>
                                    <div className="flex items-center gap-1 justify-between">
                                      <span className="truncate">{s.ruang}</span>
                                      {isDuplicate && <span className="text-[7px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-black uppercase shrink-0">Duplikat</span>}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setImportedSchedules([]);
                            setImportFileName("");
                            setImportWeekStartDate("");
                            setImportDefaultLab("");
                          }}
                          className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-bold transition cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={confirmImport}
                          className="flex-1 px-4 py-2 text-white rounded-xl text-[10px] font-bold transition cursor-pointer shadow-md"
                          style={{ backgroundColor: "#4bc9bf" }}
                        >
                          Simpan Semua
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT PANEL: FORM ENTRI MANUAL (lg:col-span-7) */}
              <div className="lg:col-span-7">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                  {/* Header Banner */}
                  <div className="p-6 text-white flex items-center gap-3" style={{ backgroundColor: "#4b8fca" }}>
                    <div className="p-2 bg-white/10 rounded-xl">
                      <Calendar size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base font-display">Form Entri Manual Jadwal Kuliah</h3>
                      <p className="text-[10px] text-white/80">Silakan lengkapi seluruh kolom di bawah ini</p>
                    </div>
                  </div>

                  {/* Form Content */}
                  <form onSubmit={handleAddSchedule} className="p-6 space-y-5">
                    {/* Lab Apa Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Laboratorium / Ruangan
                      </label>
                      <select
                        required
                        value={inputLab}
                        onChange={(e) => {
                          const newLab = e.target.value;
                          setInputLab(newLab);
                          if (isUmPtkinMode) {
                            setInputKelas(newLab);
                          } else if (isLockedLab(newLab)) {
                            setInputProdi("Umum");
                            setInputMatkul("");
                            setInputKeterangan("");
                          } else {
                            if (isLockedLab(inputLab)) {
                              setInputProdi("");
                              setInputMatkul("");
                            }
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition bg-slate-50/50"
                      >
                        <option value="">-- Pilih Laboratorium --</option>
                        {filteredLaboratories.map((lab) => (
                          <option key={lab.id} value={lab.name}>
                            {lab.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Prodi & Kelas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Program Studi (Prodi)
                        </label>
                        <input
                          type="text"
                          required={!isUmPtkinMode}
                          disabled={isLockedLab(inputLab) || isUmPtkinMode}
                          placeholder={isUmPtkinMode ? "UM PTKIN (Otomatis)" : (isLockedLab(inputLab) ? "Umum (Terkunci)" : "Contoh: Teknik Informatika")}
                          value={isUmPtkinMode ? "UM PTKIN" : (isLockedLab(inputLab) ? "Umum" : inputProdi)}
                          onChange={(e) => setInputProdi(e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition ${
                            isLockedLab(inputLab) || isUmPtkinMode ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 font-semibold" : "bg-slate-50/50"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Kelas
                        </label>
                        <input
                          type="text"
                          required={!isUmPtkinMode}
                          disabled={isUmPtkinMode}
                          placeholder={isUmPtkinMode ? (inputLab || "Nama Lab (Otomatis)") : "Contoh: TI-4A"}
                          value={isUmPtkinMode ? (inputLab || "Nama Lab") : inputKelas}
                          onChange={(e) => setInputKelas(e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition ${
                            isUmPtkinMode ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 font-semibold" : "bg-slate-50/50"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Matkul & Dosen */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Mata Kuliah
                        </label>
                        <input
                          type="text"
                          required={!isUmPtkinMode}
                          disabled={isLockedLab(inputLab) || isUmPtkinMode}
                          placeholder={isUmPtkinMode ? "UM PTKIN (Otomatis)" : (isLockedLab(inputLab) ? "Diisi lewat kolom Keterangan" : "Contoh: Pemrograman Berorientasi Objek")}
                          value={isUmPtkinMode ? "UM PTKIN" : (isLockedLab(inputLab) ? inputKeterangan : inputMatkul)}
                          onChange={(e) => setInputMatkul(e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition ${
                            isLockedLab(inputLab) || isUmPtkinMode ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 font-semibold" : "bg-slate-50/50"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          {isUmPtkinMode ? "Dosen Pengawas (Terblokir)" : "Nama Dosen Pengampu"}
                        </label>
                        <input
                          type="text"
                          required={!isUmPtkinMode}
                          disabled={isUmPtkinMode}
                          placeholder={isUmPtkinMode ? "Silakan isi per sesi di bawah..." : "Contoh: Dr. Irwan, M.T."}
                          value={isUmPtkinMode ? "Diisi per Sesi di Bawah" : inputDosen}
                          onChange={(e) => setInputDosen(e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition ${
                            isUmPtkinMode ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 font-semibold" : "bg-slate-50/50"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Radio / Checkbox Mode UM PTKIN (Di bawah field Dosen) */}
                    <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id="umPtkinToggle"
                          checked={isUmPtkinMode}
                          onChange={(e) => {
                            const active = e.target.checked;
                            setIsUmPtkinMode(active);
                            if (active) {
                              setInputProdi("UM PTKIN");
                              setInputMatkul("UM PTKIN");
                              if (inputLab) setInputKelas(inputLab);
                            } else {
                              setInputProdi("");
                              setInputMatkul("");
                              setInputKelas("");
                            }
                          }}
                          className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                        />
                        <label htmlFor="umPtkinToggle" className="text-xs font-bold text-amber-900 cursor-pointer select-none">
                          Sedang Ada UM PTKIN
                        </label>
                      </div>
                      {isUmPtkinMode && (
                        <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Mode UM PTKIN Aktif
                        </span>
                      )}
                    </div>

                    {/* Input Dosen Pengawas Per Sesi (Jika mode UM PTKIN aktif) */}
                    {isUmPtkinMode && (
                      <div className="bg-amber-50/40 border border-amber-200/80 p-4 rounded-2xl space-y-3">
                        <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          <Clock size={14} className="text-amber-600 shrink-0" />
                          Dosen Pengawas Per Sesi Ujian (07:30 - 15:30)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Sesi 1 (07:30 - 10:00)
                            </label>
                            <input
                              type="text"
                              placeholder="Nama Pengawas Sesi 1..."
                              value={umSupervisors.sesi1}
                              onChange={(e) => setUmSupervisors(prev => ({ ...prev, sesi1: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none text-xs bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Sesi 2 (10:00 - 12:30)
                            </label>
                            <input
                              type="text"
                              placeholder="Nama Pengawas Sesi 2..."
                              value={umSupervisors.sesi2}
                              onChange={(e) => setUmSupervisors(prev => ({ ...prev, sesi2: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none text-xs bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Sesi 3 (12:30 - 15:00)
                            </label>
                            <input
                              type="text"
                              placeholder="Nama Pengawas Sesi 3..."
                              value={umSupervisors.sesi3}
                              onChange={(e) => setUmSupervisors(prev => ({ ...prev, sesi3: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none text-xs bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Sesi 4 (15:00 - 15:30)
                            </label>
                            <input
                              type="text"
                              placeholder="Nama Pengawas Sesi 4..."
                              value={umSupervisors.sesi4}
                              onChange={(e) => setUmSupervisors(prev => ({ ...prev, sesi4: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none text-xs bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Keterangan (Only shown if Podcast, ELC 1/2, or Riset is selected) */}
                    {isLockedLab(inputLab) && !isUmPtkinMode && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Keterangan Kegiatan
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: keterangan podcast membahas masyarakat"
                          value={inputKeterangan}
                          onChange={(e) => {
                            setInputKeterangan(e.target.value);
                            setInputMatkul(e.target.value);
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition bg-slate-50/50"
                        />
                      </div>
                    )}

                    {/* Tanggal Pelaksanaan */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Tanggal Pelaksanaan
                      </label>
                      <input
                        type="date"
                        required
                        min={getTodayDateString()}
                        value={inputTanggal}
                        onChange={(e) => setInputTanggal(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition bg-slate-50/50"
                      />
                    </div>

                    {/* Jam Mulai & Jam Selesai atau Banner Otomatis UM PTKIN */}
                    {isUmPtkinMode ? (
                      <div className="bg-amber-50/80 border border-amber-200 text-amber-900 p-4 rounded-2xl text-xs space-y-1">
                        <span className="font-bold block text-amber-950">Penjadwalan Otomatis Ujian UM PTKIN (07:30 - 15:30)</span>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          Sistem akan otomatis membuat 4 sesi jadwal penuh (Sesi 1: 07:30-10:00, Sesi 2: 10:00-12:30, Sesi 3: 12:30-15:00, Sesi 4: 15:00-15:30) pada laboratorium dan tanggal yang dipilih, serta memblokir slot tersebut dari pemesanan mahasiswa.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Jam Mulai
                          </label>
                          <input
                            type="time"
                            required
                            value={inputJamMulai}
                            onChange={(e) => setInputJamMulai(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition bg-slate-50/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Jam Selesai
                          </label>
                          <input
                            type="time"
                            required
                            value={inputJamSelesai}
                            onChange={(e) => setInputJamSelesai(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition bg-slate-50/50"
                          />
                        </div>
                      </div>
                    )}

                    {/* Submit button */}
                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setInputLab("");
                          setInputProdi("");
                          setInputKelas("");
                          setInputMatkul("");
                          setInputDosen("");
                          setInputTanggal("");
                          setInputJamMulai("");
                          setInputJamSelesai("");
                          setInputKeterangan("");
                          setActiveTab("data-penggunaan");
                        }}
                        className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition text-xs cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-3 text-white rounded-xl font-bold transition text-xs shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                        style={{ backgroundColor: "#4bc9bf" }}
                      >
                        Buat Jadwal
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================== MODAL: DETAIL DATA ==================== */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-6 text-white flex items-center justify-between" style={{ backgroundColor: "#4b8fca" }}>
              <div className="flex items-center gap-3">
                <Info size={20} />
                <h3 className="font-bold text-base font-display">Detail Penggunaan Laboratorium</h3>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Hari</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">{selectedLog.hari}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Jam</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">{selectedLog.jam}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Nama Dosen</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{selectedLog.dosen}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Mata Kuliah</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{selectedLog.matkul}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Program Studi</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{selectedLog.prodi}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Kelas</span>
                  <span className="font-mono font-bold text-slate-800 text-sm mt-0.5 block">{selectedLog.kelas}</span>
                </div>
              </div>

              {/* MAHASISWA FIELDS */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 bg-slate-50/50 p-2.5 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Nama Penanggung Jawab Mhs</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{selectedLog.mahasiswa || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">NIM</span>
                  <span className="font-mono font-semibold text-slate-800 text-sm mt-0.5 block">{selectedLog.nim || "-"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">No WhatsApp</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-semibold text-slate-800 text-sm block">{selectedLog.numberwa || "-"}</span>
                    {selectedLog.numberwa && (
                      <a
                        href={`https://wa.me/${formatWhatsAppNumber(selectedLog.numberwa)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                      >
                        <MessageCircle size={10} /> Chat
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Jumlah Hadir</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{selectedLog.jumlahHadir || "-"} Orang</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Laboratorium</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{selectedLog.ruang || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tanggal Input</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{selectedLog.tanggalInput}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: EDIT DATA ==================== */}
      {editingLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden my-8">
            {/* Header */}
            <div className="p-6 text-white flex items-center justify-between" style={{ backgroundColor: "#4b8fca" }}>
              <div className="flex items-center gap-3">
                <Edit size={20} />
                <h3 className="font-bold text-base font-display">Edit Penggunaan Laboratorium</h3>
              </div>
              <button 
                onClick={() => setEditingLog(null)}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit}>
              <div className="p-6 space-y-4 text-xs max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hari</label>
                    <select
                      value={editFormData.hari}
                      onChange={(e) => setEditFormData({ ...editFormData, hari: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
                    >
                      {listHari.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Jam</label>
                    <input
                      type="time"
                      value={editFormData.jam}
                      onChange={(e) => setEditFormData({ ...editFormData, jam: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nama Dosen</label>
                  <input
                    type="text"
                    value={editFormData.dosen}
                    onChange={(e) => setEditFormData({ ...editFormData, dosen: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Prodi</label>
                    <select
                      value={editFormData.prodi}
                      onChange={(e) => setEditFormData({ ...editFormData, prodi: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
                    >
                      {listProdi.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kelas</label>
                    <input
                      type="text"
                      value={editFormData.kelas}
                      onChange={(e) => setEditFormData({ ...editFormData, kelas: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mata Kuliah</label>
                  <input
                    type="text"
                    value={editFormData.matkul}
                    onChange={(e) => setEditFormData({ ...editFormData, matkul: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nama Mahasiswa</label>
                    <input
                      type="text"
                      value={editFormData.mahasiswa}
                      onChange={(e) => setEditFormData({ ...editFormData, mahasiswa: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">NIM</label>
                    <input
                      type="text"
                      value={editFormData.nim}
                      onChange={(e) => setEditFormData({ ...editFormData, nim: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">No WhatsApp</label>
                    <input
                      type="text"
                      value={editFormData.numberwa}
                      onChange={(e) => setEditFormData({ ...editFormData, numberwa: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Jumlah Hadir</label>
                    <input
                      type="number"
                      min="0"
                      max="36"
                      value={editFormData.jumlahHadir}
                      onChange={(e) => setEditFormData({ ...editFormData, jumlahHadir: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tanggal Input</label>
                  <input
                    type="date"
                    value={editFormData.tanggalInput}
                    onChange={(e) => setEditFormData({ ...editFormData, tanggalInput: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white rounded-xl font-bold transition text-xs shadow-md cursor-pointer"
                  style={{ backgroundColor: "#4bc9bf" }}
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* TOKEN EXPIRED POPUP OVERLAY */}
      {tokenExpired && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            padding: '40px 36px 32px',
            maxWidth: '420px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 25px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)',
            animation: 'popupSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {/* Icon */}
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #f97316, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)',
            }}>
              <Clock size={36} color="white" />
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#1e293b',
              marginBottom: '12px',
              fontFamily: 'inherit',
            }}>
              Sesi Admin Berakhir
            </h3>

            {/* Message */}
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              lineHeight: 1.6,
              marginBottom: '28px',
            }}>
              Token admin Anda sudah habis, silahkan login ulang
            </p>

            {/* Button */}
            <button
              onClick={() => {
                handleTokenExpired();
                navigate('/dashboard');
              }}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: 'linear-gradient(135deg, #4b8fca, #3b7dd8)',
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(75, 143, 202, 0.35)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(75, 143, 202, 0.45)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(75, 143, 202, 0.35)';
              }}
            >
              Kembali ke Halaman Utama
            </button>
          </div>

          {/* Inline keyframe animations */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes popupSlideIn {
              from {
                opacity: 0;
                transform: scale(0.9) translateY(20px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
          `}</style>
        </div>
      )}

    </div>
  );
}
