import React, { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useOnlineStatus } from "../lib/useOnlineStatus";

// `inline` keeps the banner in the page flow (pushes content down) instead of floating
// over it, so it never covers the action buttons under the header.
export const OfflineIndicator: React.FC<{ inline?: boolean }> = ({ inline = false }) => {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const wrapperClass = inline
    ? "px-4 pt-3 animate-in slide-in-from-top-2 duration-300"
    : "fixed top-18 left-1/2 -translate-x-1/2 z-40 max-w-[92vw] sm:max-w-md w-full animate-in slide-in-from-top-2 duration-300 pointer-events-none";

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowReconnected(false);
    } else if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <aside
        aria-label="Status koneksi offline"
        className={wrapperClass}
      >
        <div className="mx-auto max-w-md flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-amber-500/95 dark:bg-amber-600/95 text-neutral-950 shadow-lg backdrop-blur-md border border-amber-400 text-xs font-medium pointer-events-auto">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-950"></span>
          </span>
          <WifiOff className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1">
            <strong>Mode Offline</strong>: Data tersimpan lokal & siap sync.
          </span>
        </div>
      </aside>
    );
  }

  if (showReconnected) {
    return (
      <aside
        aria-label="Status koneksi online"
        className={wrapperClass}
      >
        <div className="mx-auto max-w-md flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-emerald-500/95 dark:bg-emerald-600/95 text-white shadow-lg backdrop-blur-md border border-emerald-400 text-xs font-medium pointer-events-auto">
          <Wifi className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1">
            <strong>Kembali Online</strong>: Data terhubung ke cloud.
          </span>
        </div>
      </aside>
    );
  }

  return null;
};
