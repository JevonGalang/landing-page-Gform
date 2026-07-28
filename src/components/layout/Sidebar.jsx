import { useContext } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Info, CircleHelp, Phone, Headphones, X, ShieldCheck } from "lucide-react";
import { AppContext } from "../../context/AppContext";
import logoUIN from "../../assets/logoUIN.jpg";
import logoFST from "../../assets/logoFST.jpeg";

const menus = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Pemesanan Ruang", path: "/booking", icon: CalendarDays },
  { name: "Panel Admin", path: "/admin", icon: ShieldCheck, requiresAdmin: true },
  { name: "Informasi Lab", path: "/laboratories", icon: Info },
  { name: "Panduan Penggunaan", path: "/guide", icon: CircleHelp },
  { name: "Kontak & Bantuan", path: "/contact", icon: Phone },
];

// Extracted outside Sidebar to avoid re-creation during render
const SidebarContent = ({ showCloseBtn = false, setSidebarOpen }) => {
  const { isAdminAuthenticated } = useContext(AppContext);

  return (
    <div className="sidebar-container">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="flex flex-col items-start gap-3 w-full">
          <h1 className="sidebar-title mb-0 text-[20px] lg:text-[21px]">Lab MaTiSi</h1>
          
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center border border-slate-100 shrink-0">
              <img src={logoUIN} alt="UIN Logo" className="w-full h-full object-cover" />
            </div>
            <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center border border-slate-100 shrink-0">
              <img src={logoFST} alt="FST Logo" className="w-full h-full object-cover" />
            </div>
          </div>

          <p className="sidebar-subtitle !max-w-full text-[10.5px] lg:text-[11px] leading-relaxed">
            Laboratorium Komputer Prodi Matematika, Teknik Informatika dan Sistem Informasi
          </p>
        </div>

        {/* Mobile Close Button */}
        {showCloseBtn && (
          <button 
            onClick={() => setSidebarOpen(false)}
            className="sidebar-close-btn"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {menus.map((item) => {
          // Hide admin items if not authenticated
          if (item.requiresAdmin && !isAdminAuthenticated) {
            return null;
          }

          const Icon = item.icon;

          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                    : "text-slate-500 hover:bg-slate-50 hover:text-blue-600"
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Help Card */}
      <div className="sidebar-help-card">
        <div className="sidebar-help-header">
          <div className="sidebar-help-icon">
            <Headphones size={18} />
          </div>
          <div>
            <h4 className="sidebar-help-title">Butuh Bantuan?</h4>
            <p className="sidebar-help-subtitle">Hubungi Admin Lab</p>
          </div>
        </div>
        <a
          href="https://wa.me/628123456789"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setSidebarOpen(false)}
          className="sidebar-help-btn"
        >
          Hubungi Sekarang <span className="font-mono text-[10px]">&gt;</span>
        </a>
      </div>
    </div>
  );
};

export default function Sidebar() {
  const { isSidebarOpen, setSidebarOpen } = useContext(AppContext);

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <aside className="sidebar">
        <SidebarContent showCloseBtn={false} setSidebarOpen={setSidebarOpen} />
      </aside>

      {/* Mobile Drawer Sidebar */}
      <div 
        className={`sidebar-drawer-overlay ${
          isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`} 
        onClick={() => setSidebarOpen(false)}
      >
        <aside 
          className={`sidebar-drawer-aside ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`} 
          onClick={(e) => e.stopPropagation()}
        >
          <SidebarContent showCloseBtn={true} setSidebarOpen={setSidebarOpen} />
        </aside>
      </div>
    </>
  );
}
