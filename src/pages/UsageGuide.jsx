import { BookOpen, AlertCircle } from "lucide-react";

// Static imports of guide images
import tutor1 from "../assets/TUTOR1.png";
import tutor3 from "../assets/TUTOR3.png";
import tutor4 from "../assets/TUTOR4.png";

export default function UsageGuide() {
  const steps = [
    {
      step: "01",
      title: "Pilih Ruang & Cek Jadwal",
      desc: "Masuk ke dashboard Lab MaTiSi, lihat daftar laboratorium yang tersedia, lalu periksa ketersediaan ruangan yang ingin dipesan.",
      image: tutor1,
    },
    {
      step: "02",
      title: "Buka & Isi Formulir Pemesanan",
      desc: 'Klik menu "Pemesanan Ruang" di sidebar kiri. Lengkapi data seperti nama penanggung jawab, nomor WhatsApp aktif, nama kegiatan/mata kuliah, serta tanggal dan jam peminjaman.',
      image: tutor3,
    },
    {
      step: "03",
      title: "Pantau Status & Hubungi Laboran",
      desc: 'Setelah kirim, periksa status pemesanan Anda secara berkala. Koordinasikan dengan laboran atau admin melalui halaman "Kontak & Bantuan" untuk kunci ruangan.',
      image: tutor4,
    }
  ];

  return (
    <div className="px-4 md:px-8 max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
        
        {/* Header Sederhana */}
        <div className="mb-8 flex items-start gap-3.5 pb-5 border-b border-slate-100">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-2xl shrink-0">
            <BookOpen size={22} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 font-display">
              Panduan Peminjaman Laboratorium MaTiSi
            </h2>
            <p className="text-slate-500 text-xs font-medium mt-1 leading-relaxed">
              Ikuti panduan mudah ini untuk melakukan pemesanan fasilitas laboratorium
            </p>
          </div>
        </div>

        {/* Daftar Langkah Panduan */}
        <div className="space-y-10">
          {steps.map((item, index) => (
            <div key={index} className="flex gap-4 items-start">
              {/* Nomor Langkah Bulat */}
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-sm shadow-blue-100 mt-0.5">
                {item.step}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-extrabold text-slate-800 text-sm font-display">
                  {item.title}
                </h4>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed font-medium">
                  {item.desc}
                </p>

                {/* Gambar Screenshot Statis */}
                {item.image && (
                  <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xs mt-3 transition hover:shadow-md">
                    <img
                      src={item.image}
                      alt={`Screenshot Langkah ${item.step}`}
                      className="w-full h-auto object-cover max-h-[350px] block"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Kotak Info/Catatan Penting */}
        <div className="mt-10 p-5 bg-amber-50/50 border border-amber-100 rounded-2xl flex gap-3.5">
          <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <div>
            <h5 className="text-xs font-extrabold text-amber-800">
              Catatan Penting
            </h5>
            <ul className="text-[11px] text-amber-700/90 space-y-1.5 font-semibold mt-2.5 list-disc pl-4">
              <li>Lakukan pemesanan lab minimal <strong> sebelum pelaksanaan kegiatan.</strong></li>
              <li>Pastikan nomor WhatsApp yang Anda masukkan valid dan aktif agar mudah dihubungi oleh laboran.</li>
              <li>Jika ada pembatalan peminjaman, segera hubungi admin melalui menu <strong>Kontak & Bantuan</strong>.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
