import { useState } from 'react';

export default function ContactSupport() {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle', 'sending', 'success'

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus('sending');
    setTimeout(() => {
      setStatus('success');
    }, 1200);
  };

  const handleReset = () => {
    setName('');
    setMessage('');
    setStatus('idle');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Kontak & Bantuan</h2>
        <p className="text-gray-500 text-sm">Punya pertanyaan atau kendala seputar lab? Tim admin kami siap membantu.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Jalur Cepat */}
        <div className="md:col-span-1 space-y-4">
          <a 
            href="https://wa.me/6282114720105" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="p-4 bg-white border border-gray-100 rounded-xl flex items-center gap-3 hover:border-green-200 hover:shadow-xs transition duration-200 cursor-pointer block"
          >
            <div className="p-3 bg-green-50 text-green-600 rounded-xl text-xl">💬</div>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase">WhatsApp</p>
              <p className="text-sm font-bold text-gray-700">+62 8211 4720 105</p>
            </div>
          </a>
          <a 
            href="mailto:lab.matisi@uin.ac.id" 
            className="p-4 bg-white border border-gray-100 rounded-xl flex items-center gap-3 hover:border-blue-200 hover:shadow-xs transition duration-200 cursor-pointer block"
          >
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl text-xl">📧</div>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase">Email Resmi</p>
              <p className="text-sm font-bold text-gray-700">matisiplt@gmail.com</p>
            </div>
          </a>
        </div>

        {/* Form Kirim Kritik/Saran */}
        {status === 'success' ? (
          <div className="md:col-span-2 bg-white p-6 border border-gray-100 rounded-2xl shadow-sm text-center flex flex-col justify-center items-center min-h-[260px] transition-all">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-3xl mb-4 animate-bounce">
              ✓
            </div>
            <h4 className="font-bold text-gray-800 text-lg mb-1">Pesan Berhasil Dikirim!</h4>
            <p className="text-gray-500 text-sm max-w-sm mb-6 leading-relaxed">
              Terima kasih, <strong>{name}</strong>. Pesan Anda telah terkirim ke sistem kami. Tim admin Lab MaTiSi akan segera memproses pesan Anda.
            </p>
            <button 
              onClick={handleReset}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition shadow-md shadow-blue-100 cursor-pointer"
            >
              Kirim Pesan Lain
            </button>
          </div>
        ) : (
          <div className="md:col-span-2 bg-white p-5 border border-gray-100 rounded-2xl shadow-sm">
            <h4 className="font-bold text-gray-800 mb-3 text-base">Kirim Pesan Langsung</h4>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <input 
                type="text" 
                placeholder="Nama Lengkap / NIM" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required 
                className="w-full p-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-gray-50" 
              />
              <textarea 
                placeholder="Tulis kendala atau pertanyaan Anda di sini..." 
                rows="3" 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required 
                className="w-full p-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-gray-50"
              ></textarea>
              <button 
                type="submit" 
                disabled={status === 'sending'}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {status === 'sending' ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Mengirim...
                  </>
                ) : (
                  "Kirim Pesan"
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}