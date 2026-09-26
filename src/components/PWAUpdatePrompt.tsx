import React, { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { registerSW } from "virtual:pwa-register";

export const PWAUpdatePrompt: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateFunction, setUpdateFunction] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    try {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          setNeedRefresh(true);
        },
        onOfflineReady() {
          console.log("[PWA] App is ready to work offline.");
        },
      });
      setUpdateFunction(() => updateSW);
    } catch (e) {
      console.warn("[PWA] Service worker registration error:", e);
    }
  }, []);

  const handleUpdate = async () => {
    if (updateFunction) {
      await updateFunction();
    }
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] sm:max-w-md w-full animate-in slide-in-from-bottom-3 duration-300">
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-neutral-900/95 dark:bg-white/95 text-white dark:text-neutral-900 shadow-2xl border border-neutral-700 dark:border-neutral-200 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4 animate-spin" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight">Pembaruan Tersedia</p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-600 truncate">
              Versi baru Qicau siap digunakan.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUpdate}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-neutral-950 text-xs font-bold transition-all shadow-sm"
          >
            Perbarui
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="p-1 rounded-full text-neutral-400 hover:text-white dark:hover:text-neutral-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
