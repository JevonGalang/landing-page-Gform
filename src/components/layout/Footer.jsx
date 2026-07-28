import { Mail } from "lucide-react";
import logoUIN from "../../assets/logoUIN.jpg";
import logoFST from "../../assets/logoFST.jpeg"
export default function Footer() {
  return (
    <footer className="footer-container">
      {/* Left: Brand
      <div className="footer-brand">
        <div className="footer-logo-container">
          <img src={logoUIN} alt="UIN Logo" className="footer-logo" />
         <img src={logoFST} alt="logoFST harusnya disini bray" className="footer-logoFST "/>
        </div>
         
         <div className="footer-brand-info">
          <h4 className="footer-brand-title">Lab MaTiSi</h4>
          <p className="footer-brand-subtitle">Laboratorium Komputer dan Fasilitas Lainnya</p>
        </div>
      </div> */}

      {/* Left placeholder to center copyright on desktop */}
      <div className="hidden md:block w-[132px]"></div>

      {/* Center: Copyright */}
      <div className="footer-copyright">
        © 2026 FST PLT Matisi - All rights reserved.
      </div>

      {/* Right: Social Media */}
      <div className="footer-socials">
        {/* Inline SVG Facebook */}
        <a
          href="#"
          className="social-link"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="w-4 h-4"
          >
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
          </svg>
        </a>

        {/* Inline SVG Instagram */}
        <a
          href="#"
          className="social-link"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="w-4 h-4"
          >
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </svg>
        </a>

        {/* Lucide Mail Icon */}
        <a
          href="#"
          className="social-link"
        >
          <Mail size={16} className="stroke-[2.2]" />
        </a>
      </div>
    </footer>
  );
}
