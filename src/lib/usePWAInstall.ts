import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// A normal browser tab can't tell that the app is already installed, so remember it.
// Browsers only fire `beforeinstallprompt` while the app is NOT installed, which is
// how a stale flag (e.g. after uninstalling) is corrected.
const INSTALLED_KEY = "qicau_pwa_installed";

// Set when the app gets installed; consumed by the installed window's first launch
// (see App.tsx) so the user still sees a confirmation if the browser moved focus.
export const INSTALL_TOAST_PENDING_KEY = "qicau_pwa_install_toast_pending";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: fall back to non-persistent behaviour */
  }
}

export function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneDisplay() || readStorage(INSTALLED_KEY) === "1");
  const [isIOS, setIsIOS] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(true);

  useEffect(() => {
    // Detect standalone mode (already installed or opened in standalone window)
    setIsInstalled(isStandaloneDisplay() || readStorage(INSTALLED_KEY) === "1");

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);
    // Chrome/Firefox/Edge/Opera on iOS put the Share button elsewhere than Safari does
    setIsIOSSafari(!/crios|fxios|edgios|opios/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // The browser only offers installation when the app isn't installed.
      writeStorage(INSTALLED_KEY, null);
      setIsInstalled(false);
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      writeStorage(INSTALLED_KEY, "1");
      writeStorage(INSTALL_TOAST_PENDING_KEY, String(Date.now()));
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      writeStorage(INSTALLED_KEY, "1");
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isIOSSafari,
    install,
  };
}
