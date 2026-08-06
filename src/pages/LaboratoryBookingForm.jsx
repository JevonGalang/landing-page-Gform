import { useState, useContext, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import { submitBooking } from "../services/bookingService";
import Swal from "sweetalert2";

const parseScheduleTimes = (tanggalInput, jam) => {
  if (!tanggalInput) return { start: null, end: null };
  try {
    const [year, month, day] = tanggalInput.split("-").map(Number);
    let startHour = 8, startMinute = 0;
    let endHour = 17, endMinute = 0;
    if (jam && jam.includes("-")) {
      const parts = jam.split("-").map(s => s.trim());
      const startTimeStr = parts[0];
      const endTimeStr = parts[1];
      if (startTimeStr && startTimeStr.includes(":")) {
        const [h, m] = startTimeStr.split(":").map(Number);
        if (!isNaN(h)) startHour = h;
        if (!isNaN(m)) startMinute = m;
      }
      if (endTimeStr && endTimeStr.includes(":")) {
        const [h, m] = endTimeStr.split(":").map(Number);
        if (!isNaN(h)) endHour = h;
        if (!isNaN(m)) endMinute = m;
      }
    }
    const start = new Date(year, month - 1, day, startHour, startMinute, 0);
    const end = new Date(year, month - 1, day, endHour, endMinute, 0);
    return { start, end };
  } catch (e) {
    return { start: null, end: null };
  }
};
import {
  ClipboardList, Send, AlertCircle, Calendar, Clock, BookOpen,
  User, Hash, Phone, Users, MapPin, CheckCircle, Search, Filter, X
} from "lucide-react";

export default function LaboratoryBookingForm() {
  const navigate = useNavigate();
  const {
    selectedLaboratory,
    setSelectedLaboratory,
    mySchedules,
    setMySchedules,
    refreshData,
    laboratories,
  } = useContext(AppContext);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Pre-fill lab name from dashboard click
  const preselectedLabName = selectedLaboratory?.name || "";

  // Show empty, pending, and approved schedules
  const availableSchedules = mySchedules.filter(
    (s) => s.status === "kosong" || s.status === "dipesan" || s.status === "diterima"
  );

  // Search & filter state — pre-fill filterRuang if came from lab card
  const [searchQuery, setSearchQuery] = useState("");
  const [filterHari, setFilterHari] = useState("");
  const [filterRuang, setFilterRuang] = useState(preselectedLabName);

  // Unique list of hari for filter dropdown
  const uniqueHari = [...new Set(availableSchedules.map((s) => s.hari))].filter(Boolean);

  // Get all laboratory names from context to display all labs in the select dropdown
  const uniqueRuang = useMemo(() => {
    if (laboratories && laboratories.length > 0) {
      return laboratories.map((l) => l.name);
    }
    return [...new Set(availableSchedules.map((s) => s.ruang))].filter(Boolean);
  }, [laboratories, availableSchedules]);

  // Apply search & filters
  const filteredSchedules = availableSchedules.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      s.matkul?.toLowerCase().includes(q) ||
      s.dosen?.toLowerCase().includes(q) ||
      s.ruang?.toLowerCase().includes(q) ||
      s.prodi?.toLowerCase().includes(q) ||
      s.kelas?.toLowerCase().includes(q);
    const matchHari = !filterHari || s.hari === filterHari;
    const matchRuang = !filterRuang || s.ruang?.toLowerCase() === filterRuang.toLowerCase();
    return matchSearch && matchHari && matchRuang;
  });

  const hasActiveFilter = searchQuery || filterHari || filterRuang;

  const clearFilters = () => {
    setSearchQuery("");
    setFilterHari("");
    setFilterRuang("");
  };

  // Selected schedule from admin list
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const selectedSchedule = mySchedules.find((s) => s.id === parseInt(selectedScheduleId, 10)) || null;

  // Cari kapasitas lab terpilih secara dinamis dari backend data
  const getCurrentLabCapacity = () => {
    let labName = "";
    if (selectedSchedule) {
      labName = selectedSchedule.ruang;
    } else if (selectedLaboratory) {
      labName = selectedLaboratory;
    }
    
    if (!labName) return 36; // default fallback
    
    const matchedLab = (laboratories || []).find(l => 
      l && String(l.name || l.nama || l.nama_lab).toLowerCase() === String(labName).toLowerCase()
    );
    return matchedLab && matchedLab.capacity ? parseInt(matchedLab.capacity, 10) : 36;
  };
  
  const currentMaxCapacity = getCurrentLabCapacity();

  // Student data form
  const [formData, setFormData] = useState({
    mahasiswa: "",
    nim: "",
    kelas: "",
    numberwa: "",
    jumlahHadir: "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleScheduleSelect = (id) => {
    setSelectedScheduleId(id);
    const sched = mySchedules.find((s) => s.id === parseInt(id, 10));
    if (sched) {
      setFormData((prev) => ({
        ...prev,
        kelas: sched.kelas && sched.kelas !== "-" ? sched.kelas : prev.kelas || "",
      }));
    }
    if (errors.schedule) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.schedule;
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!selectedScheduleId) {
      newErrors.schedule = "Silakan pilih jadwal kuliah yang tersedia terlebih dahulu.";
    } else {
      const scheduleBackendId = selectedSchedule?._type === "logbook"
        ? selectedSchedule?._scheduleId
        : (selectedSchedule?._backendId || selectedSchedule?.id);
      if (scheduleBackendId) {
        const isAlreadyBooked = mySchedules.some(
          (s) =>
            s._type === "logbook" &&
            parseInt(s._scheduleId, 10) === parseInt(scheduleBackendId, 10) &&
            s.status !== "ditolak"
        );
        if (isAlreadyBooked) {
          newErrors.schedule = "Maaf, ruangan untuk jadwal ini sudah dipesan oleh mahasiswa lain.";
        }
      }
    }
    if (!formData.mahasiswa.trim()) {
      newErrors.mahasiswa = "Nama mahasiswa wajib diisi.";
    }
    if (!formData.nim.trim()) {
      newErrors.nim = "NIM mahasiswa wajib diisi.";
    }
    if (!formData.kelas.trim()) {
      newErrors.kelas = "Kelas wajib diisi.";
    }
    if (!formData.numberwa.trim()) {
      newErrors.numberwa = "Nomor telepon wajib diisi.";
    } else if (!/^(\+?62|08)\d{8,13}$/.test(formData.numberwa.trim())) {
      newErrors.numberwa = "Format nomor WhatsApp tidak valid. Contoh: 081234567890";
    }
    if (!formData.jumlahHadir) {
      newErrors.jumlahHadir = "Jumlah yang hadir wajib diisi.";
    } else if (parseInt(formData.jumlahHadir, 10) < 1) {
      newErrors.jumlahHadir = "Jumlah hadir minimal 1 orang.";
    } else if (parseInt(formData.jumlahHadir, 10) > currentMaxCapacity) {
      newErrors.jumlahHadir = `Jumlah hadir maksimal ${currentMaxCapacity} orang.`;
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    if (!isValid) {
      console.log("Pengiriman gagal (validasi form):", newErrors);
    }
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if this schedule is already booked right before validation to alert user
    const scheduleBackendId = selectedSchedule?._type === "logbook"
      ? selectedSchedule?._scheduleId
      : (selectedSchedule?._backendId || selectedSchedule?.id);
    if (scheduleBackendId) {
      const isAlreadyBooked = mySchedules.some(
        (s) =>
          s._type === "logbook" &&
          parseInt(s._scheduleId, 10) === parseInt(scheduleBackendId, 10) &&
          s.status !== "ditolak"
      );
      if (isAlreadyBooked) {
        Swal.fire({
          icon: "warning",
          title: "Jadwal Sudah Dipesan",
          text: "Maaf, ruangan untuk jadwal ini sudah dipesan oleh mahasiswa lain. Silakan pilih jadwal lain.",
          confirmButtonColor: "#3b82f6"
        });
        return;
      }
    }

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const result = await submitBooking({
        scheduleId: scheduleBackendId,
        namaKetua: formData.mahasiswa.trim(),
        nim: formData.nim.trim(),
        kelas: formData.kelas.trim(),
        jumlahPeserta: parseInt(formData.jumlahHadir, 10),
        nomorWa: formData.numberwa.trim(),
      });

      if (result.success) {
        setSelectedLaboratory(null);
        await Swal.fire({
          icon: "success",
          title: "Pemesanan Berhasil",
          text: `Pemesanan ${selectedSchedule?.ruang} berhasil dikirim!\nStatus: Dipesan.`,
          confirmButtonColor: "#3b82f6"
        });
        navigate("/dashboard");
      } else {
        Swal.fire({
          icon: "error",
          title: "Gagal Mengirim",
          text: `Gagal mengirim pemesanan: ${result.message}`,
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">

        {/* Header */}
        <div className="p-6 text-white" style={{ backgroundColor: "#4b8fca" }}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl shrink-0">
              <ClipboardList size={26} />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display">
                {preselectedLabName
                  ? `Pemesanan — ${preselectedLabName}`
                  : "Pemesanan Ruang Laboratorium"}
              </h1>
              <p className="text-xs text-white/80 mt-0.5">
                {preselectedLabName
                  ? `Menampilkan jadwal yang tersedia di ${preselectedLabName}.`
                  : "Pilih jadwal yang dibuat admin, lalu lengkapi data diri Anda."}
              </p>
            </div>
          </div>

          {/* Lab info banner — schedules count for this lab */}
          {preselectedLabName && (() => {
            const labSchedules = availableSchedules.filter(s => s.ruang?.toLowerCase() === preselectedLabName.toLowerCase());
            return (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
                  <Calendar size={13} className="text-white/80" />
                  <span className="text-xs font-bold text-white">
                    {labSchedules.length} jadwal tersedia di lab ini
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterRuang("")}
                  className="text-[11px] text-white/70 hover:text-white underline underline-offset-2 transition cursor-pointer"
                >
                  Lihat semua lab →
                </button>
              </div>
            );
          })()}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* ====== STEP 1: Pilih Jadwal ====== */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0" style={{ backgroundColor: "#4b8fca" }}>1</span>
              <h2 className="text-sm font-bold text-slate-800">Pilih Jadwal Kuliah</h2>
            </div>

            {availableSchedules.length === 0 ? (
              <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800">Belum Ada Jadwal Tersedia</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Admin belum membuat jadwal kuliah. Silakan hubungi admin laboratorium untuk menambahkan jadwal terlebih dahulu.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* ── Search & Filter Bar ── */}
                <div className="space-y-2">
                  {/* Search Input */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari mata kuliah, dosen, atau nama lab..."
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition placeholder:text-slate-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Filter Row */}
                  <div className="flex flex-wrap gap-2">
                    {/* Filter Hari */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
                      <Filter size={11} className="text-slate-400 shrink-0" />
                      <select
                        value={filterHari}
                        onChange={(e) => setFilterHari(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer transition"
                      >
                        <option value="">Semua Hari</option>
                        {uniqueHari.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Filter Ruang/Lab */}
                    <div className="flex-1 min-w-[140px]">
                      <select
                        value={filterRuang}
                        onChange={(e) => setFilterRuang(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer transition ${
                          filterRuang && filterRuang.toLowerCase() === preselectedLabName.toLowerCase()
                            ? "border-blue-400 bg-blue-50 text-blue-700 font-semibold"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <option value="">Semua Laboratorium</option>
                        {uniqueRuang.map((r) => {
                          const displayName = r.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                          return <option key={r} value={r}>{displayName}</option>;
                        })}
                      </select>
                    </div>

                    {/* Reset Filter Button */}
                    {hasActiveFilter && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0"
                      >
                        <X size={11} /> Reset
                      </button>
                    )}
                  </div>

                  {/* Active lab badge — shown when came from lab card */}
                  {preselectedLabName && filterRuang.toLowerCase() === preselectedLabName.toLowerCase() && (
                    <div className="flex items-center gap-1.5 text-[10px] text-blue-600 font-semibold">
                      <MapPin size={10} />
                      <span>Menampilkan jadwal untuk <strong>{preselectedLabName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</strong> &mdash; pilih lab lain dari dropdown atau tekan Reset</span>
                    </div>
                  )}

                  {/* Result count */}
                  <p className="text-[11px] text-slate-500 font-semibold">
                    Menampilkan <strong className="text-slate-700">{filteredSchedules.length}</strong> dari <strong className="text-slate-700">{availableSchedules.length}</strong> jadwal tersedia
                  </p>
                </div>

                {/* Error */}
                {errors.schedule && (
                  <p className="text-red-500 text-xs font-semibold flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.schedule}
                  </p>
                )}

                {/* Schedule Cards */}
                {filteredSchedules.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Search size={20} className="text-slate-300" />
                    </div>
                    {filterRuang && filteredSchedules.length === 0 ? (
                      <>
                        <p className="text-sm font-bold text-slate-400">Belum ada jadwal di {filterRuang}</p>
                        <p className="text-xs text-slate-300 mt-1 max-w-[240px] mx-auto leading-relaxed">
                          Admin belum menambahkan jadwal untuk lab ini. Hubungi admin atau lihat lab lain.
                        </p>
                        <button
                          type="button"
                          onClick={() => setFilterRuang("")}
                          className="mt-3 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          Lihat semua jadwal →
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-slate-400">Jadwal tidak ditemukan</p>
                        <p className="text-xs text-slate-300 mt-1">Coba kata kunci atau filter yang berbeda.</p>
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-3 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          Reset pencarian
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3.5 md:space-y-0 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
                    {filteredSchedules.map((s) => {
                      const { start, end } = parseScheduleTimes(s.tanggalInput, s.jam);
                      const now = new Date();
                      const isOngoing = start && end && now >= start && now <= end;
                      const isFinished = end && now > end;
                      const isBooked = s.status === "dipesan" || s.status === "diterima";
                      const isBookable = start && now < start && !isBooked;
                      const isDisabled = isOngoing || isFinished || isBooked;
                      const isSelected = !isDisabled && String(s.id) === selectedScheduleId;

                      let cardClass = "";
                      if (isDisabled) {
                        cardClass = "border-slate-100 bg-slate-100/50 opacity-60 cursor-not-allowed";
                      } else if (isSelected) {
                        cardClass = "border-blue-500 bg-blue-50/60 shadow-sm cursor-pointer";
                      } else {
                        cardClass = "border-slate-100 bg-slate-50/50 hover:border-blue-200 hover:bg-blue-50/20 cursor-pointer";
                      }

                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => !isDisabled && handleScheduleSelect(String(s.id))}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${cardClass}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Lab name and Status badges */}
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md text-white" style={{ backgroundColor: "#4b8fca" }}>
                                  {s.ruang}
                                </span>
                                {isOngoing && (
                                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-amber-100 border border-amber-200 text-amber-800">
                                    Sedang Digunakan
                                  </span>
                                )}
                                {isFinished && (
                                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-slate-100 border border-slate-200 text-slate-500">
                                    Sesi Selesai
                                  </span>
                                )}
                                {isBooked && (
                                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-red-50 border border-red-200 text-red-600 font-semibold">
                                    Sudah Dipesan
                                  </span>
                                )}
                                {isBookable && (
                                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700">
                                    Tersedia
                                  </span>
                                )}
                              </div>
                              {/* Matkul & Dosen */}
                              <p className="text-sm font-bold text-slate-800 leading-tight">{s.matkul}</p>
                              <p className="text-[12px] text-slate-600 mt-0.5 font-medium">{s.dosen}</p>
                              {/* Time & Date chips */}
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded-md text-[11px] font-semibold">
                                  <Calendar size={10} className="text-slate-400 shrink-0" /> {s.hari}, {s.tanggalInput}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded-md text-[11px] font-semibold">
                                  <Clock size={10} className="text-slate-400 shrink-0" /> {s.jam}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded-md text-[11px] font-semibold">
                                  <BookOpen size={10} className="text-slate-400 shrink-0" /> {s.prodi}
                                </span>
                              </div>
                            </div>
                            {/* Check indicator */}
                            {!isDisabled && (
                              <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                isSelected ? "border-blue-500 bg-blue-500" : "border-slate-300"
                              }`}>
                                {isSelected && <CheckCircle size={13} className="text-white" />}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ====== STEP 2: Data Diri Mahasiswa ====== */}
          {selectedSchedule && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0" style={{ backgroundColor: "#4bc9bf" }}>2</span>
                <h2 className="text-sm font-bold text-slate-800">Data Penanggung Jawab Mahasiswa</h2>
              </div>

              {/* Selected schedule summary card */}
              <div className="mb-5 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                <MapPin size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-emerald-800 leading-relaxed">
                  <strong>Jadwal dipilih:</strong> {selectedSchedule.ruang} — {selectedSchedule.matkul} &bull; {selectedSchedule.hari}, {selectedSchedule.jam} &bull; {selectedSchedule.dosen}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama Mahasiswa */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <User size={11} />
                      Nama Mahasiswa <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    name="mahasiswa"
                    placeholder="Nama Lengkap Penanggung Jawab"
                    value={formData.mahasiswa}
                    onChange={handleChange}
                    className={`w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-slate-50/50 transition ${
                      errors.mahasiswa ? "border-red-300 bg-red-50/30" : "border-slate-200"
                    }`}
                  />
                  {errors.mahasiswa && (
                    <p className="text-red-500 text-xs font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.mahasiswa}
                    </p>
                  )}
                </div>

                {/* NIM */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <Hash size={11} />
                      NIM <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    name="nim"
                    placeholder="Nomor Induk Mahasiswa"
                    value={formData.nim}
                    onChange={handleChange}
                    className={`w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-slate-50/50 transition ${
                      errors.nim ? "border-red-300 bg-red-50/30" : "border-slate-200"
                    }`}
                  />
                  {errors.nim && (
                    <p className="text-red-500 text-xs font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.nim}
                    </p>
                  )}
                </div>

                {/* Kelas */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <BookOpen size={11} />
                      Kelas <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    name="kelas"
                    placeholder="Contoh: TI-4A"
                    value={formData.kelas}
                    onChange={handleChange}
                    className={`w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-slate-50/50 transition ${
                      errors.kelas ? "border-red-300 bg-red-50/30" : "border-slate-200"
                    }`}
                  />
                  {errors.kelas && (
                    <p className="text-red-500 text-xs font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.kelas}
                    </p>
                  )}
                </div>

                {/* Nomor WA */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <Phone size={11} />
                      Nomor WhatsApp <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    name="numberwa"
                    placeholder="Contoh: 081234567890"
                    value={formData.numberwa}
                    onChange={handleChange}
                    className={`w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-slate-50/50 transition ${
                      errors.numberwa ? "border-red-300 bg-red-50/30" : "border-slate-200"
                    }`}
                  />
                  {errors.numberwa && (
                    <p className="text-red-500 text-xs font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.numberwa}
                    </p>
                  )}
                </div>

                {/* Jumlah Hadir */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <Users size={11} />
                      Jumlah Mahasiswa Hadir <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="number"
                    name="jumlahHadir"
                    placeholder="Estimasi mahasiswa hadir"
                    min="1"
                    max={currentMaxCapacity}
                    value={formData.jumlahHadir}
                    onChange={handleChange}
                    className={`w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-slate-50/50 transition ${
                      errors.jumlahHadir ? "border-red-300 bg-red-50/30" : "border-slate-200"
                    }`}
                  />
                  {errors.jumlahHadir && (
                    <p className="text-red-500 text-xs font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.jumlahHadir}
                    </p>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end pt-5">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  id="submit-booking-btn"
                  className="flex items-center gap-2 px-7 py-3 text-white rounded-xl font-bold text-sm shadow-md transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: "#4bc9bf", boxShadow: "0 4px 14px rgba(75, 201, 191, 0.3)" }}
                >
                  <Send size={15} />
                  {isSubmitting ? "Mengirim..." : "Kirim Pemesanan"}
                </button>
              </div>
            </div>
          )}

          {/* Prompt when no schedule selected yet */}
          {!selectedSchedule && availableSchedules.length > 0 && (
            <div className="py-4 text-center text-slate-400 text-xs font-semibold border-t border-slate-100">
              ↑ Pilih salah satu jadwal di atas untuk melanjutkan
            </div>
          )}

        </form>
      </div>
    </div>
  );

}