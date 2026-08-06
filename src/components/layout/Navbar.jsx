import { useState, useEffect, useContext } from "react";
import { Menu, Calendar, ShieldCheck, Lock, LogOut } from "lucide-react";
import { AppContext } from "../../context/AppContext";
import { Link } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import Swal from "sweetalert2";

/**
 * Navbar — Top navigation bar with date/time display and Admin access.
 */
export default function Navbar() {
  const [time, setTime] = useState(new Date());
  const { setSidebarOpen, isAdminAuthenticated, setAdminAuthenticated } = useContext(AppContext);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatIndonesianDate = (date) => {
    const days = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];

    const dayName = days[date.getDay()];
    const dayNum = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, "0");

    return `${dayName}, ${dayNum} ${monthName} ${year} | ${hoursStr}:${minutes} ${ampm}`;
  };

  return (
    <header className="navbar-container print:hidden">
      {/* Menu Button (mobile only) */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="menu-toggle-btn"
      >
        <Menu size={18} />
      </button>

      {/* Spacer for desktop */}
      <div className="hidden lg:block"></div>

      {/* Date Time & Admin button */}
      <div className="navbar-right">
        <div className="datetime-display">
          <Calendar size={15} className="text-slate-500" />
          <span>{formatIndonesianDate(time)}</span>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

      

        {/* Separator */}
        <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

        {/* Admin Access Button */}
        {isAdminAuthenticated ? (
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition shadow-xs"
            >
              <ShieldCheck size={14} />
              <span className="hidden sm:inline">Panel Admin</span>
              <span className="sm:hidden">Admin</span>
            </Link>
            <button
              onClick={async () => {
                const confirmation = await Swal.fire({
                  title: "Keluar Sesi Admin?",
                  text: "Apakah Anda yakin ingin keluar dari sesi admin?",
                  icon: "question",
                  showCancelButton: true,
                  confirmButtonText: "Ya, Keluar",
                  cancelButtonText: "Batal",
                  confirmButtonColor: "#EF4444",
                  cancelButtonColor: "#64748B"
                });
                if (confirmation.isConfirmed) {
                  setAdminAuthenticated(false);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
              title="Logout Admin"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <Link
            to="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
          >
            <Lock size={13} />
            <span>Masuk Admin</span>
          </Link>
        )}
      </div>
    </header>
  );
}
