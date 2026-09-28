import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
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

  // A hidden->visible transition means the user just switched away and back
  // (or reopened the tab) - never mid-input - so it's safe to apply the
  // update on its own without waiting for a manual click.
  useEffect(() => {
    if (!needRefresh) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleUpdate();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [needRefresh, updateFunction]);

  if (!needRefresh) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-100 animate-in slide-in-from-top duration-300">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-lg">
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
        </div>
      </div>
    </div>
  );
};
