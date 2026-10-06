import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Download, Share2, PlusSquare, X } from "lucide-react";
import { usePWAInstall } from "../lib/usePWAInstall";

interface PWAInstallButtonProps {
  variant?: "header" | "settings" | "banner";
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = "header",
  className = "",
}) => {
  const { isInstallable, isIOS, isIOSSafari, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);


  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // In browsers where beforeinstallprompt hasn't fired yet or is not supported (e.g. Firefox), show quick guide
      setShowIOSGuide(true);
    }
  };

  const renderIOSModal = () => {
    if (!showIOSGuide) return null;
    return createPortal(
      <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Download className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                Pasang Aplikasi Qicau
              </h3>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
            Pasang Qicau di layar utama perangkat Anda untuk akses instan, mode layar penuh, dan performa lebih cepat tanpa browser bar.
          </p>

          <div className="space-y-3 mb-6 bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl border border-neutral-200/60 dark:border-neutral-700/60">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                1
              </div>
              <p className="text-xs text-neutral-700 dark:text-neutral-300">
                {isIOS ? (
                  <>
                    {isIOSSafari ? (<>Ketuk tombol <strong>Bagikan</strong> (<Share2 className="w-3.5 h-3.5 inline mx-0.5" />) pada bilah navigasi Safari.</>) : (<>Ketuk tombol <strong>Bagikan</strong> (<Share2 className="w-3.5 h-3.5 inline mx-0.5" />) di bilah alamat atau menu browser Anda.</>)}
                  </>
                ) : (
                  <>
                    Buka menu browser Anda (ikon titik tiga atau tombol opsi).
                  </>
                )}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                2
              </div>
              <p className="text-xs text-neutral-700 dark:text-neutral-300">
                {isIOS ? (
                  <>
                    Gulir ke bawah dan ketuk opsi <strong>Tambah ke Layar Utama</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-0.5" />).
                  </>
                ) : (
                  <>
                    Pilih <strong>"Install Aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.
                  </>
                )}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                3
              </div>
              <p className="text-xs text-neutral-700 dark:text-neutral-300">
                Ketuk <strong>Tambah</strong> di pojok kanan atas. Ikon Qicau akan muncul di layar beranda Anda.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowIOSGuide(false)}
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-neutral-950 font-semibold py-2.5 text-sm transition-all shadow-sm"
          >
            Mengerti
          </button>
        </div>
      </div>,
      document.body
    );
  };

  if (variant === "settings") {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors text-left group ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-[#FBBF24] flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                Pasang Aplikasi (PWA)
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Akses cepat dari layar utama perangkat
              </p>
            </div>
          </div>
          <span className="text-xs font-medium px-2 py-1 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
            Pasang
          </span>
        </button>
        {renderIOSModal()}
      </>
    );
  }

  if (variant === "banner") {
    return (
      <>
        <div className={`p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-900 dark:text-white">
                Install Qicau di Perangkat Anda
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Gunakan layaknya aplikasi native tanpa install dari App Store
              </p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-bold shrink-0 active:scale-95 transition-all shadow-sm"
          >
            Pasang
          </button>
        </div>
        {renderIOSModal()}
      </>
    );
  }

  // Header compact variant
  return (
    <>
      <button
        onClick={handleInstallClick}
        aria-label="Install Aplikasi"
        title="Pasang Qicau di Layar Utama"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 active:scale-95 transition-all shadow-xs ${className}`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Pasang App</span>
        <span className="sm:hidden">Pasang</span>
      </button>
      {renderIOSModal()}
    </>
  );
};
