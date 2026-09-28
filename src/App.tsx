import { useEffect, useState } from "react";
import { signInWithPopup, onAuthStateChanged, User, GoogleAuthProvider } from "firebase/auth";
import { doc, setDoc, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { auth, googleProvider, db } from "./lib/firebase";
import { HomeView } from "./components/HomeView";
import { HistoryView } from "./components/HistoryView";
import { MonthlyView } from "./components/MonthlyView";
import { NotebookPen, History, BarChart3, Settings, Mic, Database, LogOut, Sun, Moon, Monitor, CheckCircle2, AlertCircle, X } from "lucide-react";
import { dict } from "./lib/i18n";
import { Transaction } from "./types";
import { syncToSheets } from "./lib/sheetsSync";
import { rebuildAllDailySummaries } from "./lib/dailySummary";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { PWAInstallButton } from "./components/PWAInstallButton";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { PWAUpdatePrompt } from "./components/PWAUpdatePrompt";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<"home" | "history" | "monthly">("home");
  const [showSettings, setShowSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRebuildingSummaries, setIsRebuildingSummaries] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState<false | "first" | "return">(false);
  const [toastMessage, setToastMessage] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const t = dict.id;

  // Handle PWA home screen shortcut links (e.g. /?tab=history or /?tab=monthly)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "history" || tabParam === "monthly" || tabParam === "home") {
      setCurrentTab(tabParam as any);
    }
  }, []);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const exportToSheets = () => {
    if (!user || isExporting) return;
    if (!navigator.onLine) {
      showToast("Anda sedang offline. Sinkronisasi ke Google Sheets memerlukan koneksi internet.", "error");
      return;
    }
    const hasSyncedBefore = localStorage.getItem("qicau_sheets_synced_before") === "true";
    setShowSyncConfirm(hasSyncedBefore ? "return" : "first");
  };

  const runExportToSheets = async () => {
    setShowSyncConfirm(false);
    if (!user) return;
    setIsExporting(true);

    try {
      let token = localStorage.getItem("qicau_sheets_token");
      const tokenExp = localStorage.getItem("qicau_sheets_token_exp");

      if (!token || !tokenExp || Date.now() > parseInt(tokenExp)) {
        const res = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(res);
        token = credential?.accessToken || null;

        if (token) {
          localStorage.setItem("qicau_sheets_token", token);
          localStorage.setItem("qicau_sheets_token_exp", (Date.now() + 50 * 60 * 1000).toString());
        }
      }

      if (!token) throw new Error("Akses token Google Sheets tidak tersedia.");

      const allSnap = await getDocs(query(
        collection(db, "transactions"),
        where("user_id", "==", user.uid),
        orderBy("created_at", "desc")
      ));
      const allTxs = allSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));

      if (allTxs.length === 0) {
        showToast("Tidak ada data untuk disinkronkan.");
        return;
      }

      const msg = await syncToSheets(allTxs, token, () => {});
      localStorage.setItem("qicau_sheets_synced_before", "true");
      showToast(msg || "Sinkronisasi Google Sheets Berhasil!");
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        console.log("Login popup closed by user");
        return;
      }
      console.error(e);
      localStorage.removeItem("qicau_sheets_token");
      localStorage.removeItem("qicau_sheets_token_exp");
      showToast("Gagal sinkronisasi: " + e.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const forceResetExport = () => {
    if (!user || isExporting) return;
    if (!navigator.onLine) {
      showToast("Anda sedang offline. Silakan sambungkan internet untuk reset sinkronisasi.", "error");
      return;
    }
    setShowResetConfirm(true);
  };

  const runForceResetExport = async () => {
    setShowResetConfirm(false);
    if (!user) return;
    setIsExporting(true);
    try {
      const { writeBatch } = await import("firebase/firestore");
      const allSnap = await getDocs(query(
        collection(db, "transactions"),
        where("user_id", "==", user.uid)
      ));

      const batch = writeBatch(db);
      let i = 0;
      allSnap.docs.forEach(d => {
        if (d.data().is_exported) {
          batch.update(d.ref, { is_exported: false });
          i++;
        }
      });
      if (i > 0) {
        await batch.commit();
      }
      showToast(`Berhasil mereset status ${i} transaksi! Silakan tekan tombol Sync ke Sheets sekarang.`);
    } catch (e) {
      console.error(e);
      showToast("Gagal reset sinkronisasi.", 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const rebuildSummaries = () => {
    if (!user || isRebuildingSummaries) return;
    if (!navigator.onLine) {
      showToast("Anda sedang offline. Silakan sambungkan internet untuk membangun ulang ringkasan.", "error");
      return;
    }
    setShowRebuildConfirm(true);
  };

  const runRebuildSummaries = async () => {
    setShowRebuildConfirm(false);
    if (!user) return;
    setIsRebuildingSummaries(true);
    try {
      const days = await rebuildAllDailySummaries(user.uid);
      showToast(`Berhasil membangun ulang ringkasan untuk ${days} hari!`);
    } catch (e: any) {
      console.error(e);
      showToast("Gagal membangun ulang ringkasan: " + e.message, 'error');
    } finally {
      setIsRebuildingSummaries(false);
    }
  };

  type ThemeMode = "system" | "light" | "dark";
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    (localStorage.getItem("qicau_theme") as ThemeMode) || "system"
  );

  useEffect(() => {
    const applyTheme = () => {
      const isDark = 
        themeMode === "dark" || 
        (themeMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };
    
    applyTheme();
    localStorage.setItem("qicau_theme", themeMode);
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (themeMode === "system") applyTheme();
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [themeMode]);

  useEffect(() => {
    try {
      const unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        if (u) {
          setDoc(doc(db, "users", u.uid), {
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            last_login: Date.now()
          }, { merge: true }).catch((err) => {
            console.error("Error saving user doc:", err);
          });
        }
        setLoading(false);
      });
      return unsub;
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        console.log("Login popup closed by user");
        return;
      }
      console.error(e);
      alert("Gagal login: " + e.message);
    }
  };

  const logout = () => {
    auth.signOut();
    setShowSettings(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="h-10 w-32 bg-neutral-200 dark:bg-neutral-900 rounded-lg animate-pulse self-center mb-6"></div>
          {[1,2,3].map(i => (
            <div key={i} className="h-20 w-full bg-neutral-200 dark:bg-neutral-900 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden transition-colors">
        <div className="absolute top-4 right-4 z-10">
          <PWAInstallButton variant="header" onInstalledSuccess={() => showToast("Aplikasi berhasil dipasang di layar utama!")} />
        </div>
        <OfflineIndicator />
        <PWAUpdatePrompt />
        <div className="w-20 h-20 rotate-3 flex items-center justify-center mb-6 drop-shadow-2xl overflow-hidden rounded-[2rem]">
          <img src="/images/Qicau_Logo.png" alt="Qicau Logo" className="w-full h-full object-cover -rotate-3" />
        </div>
        <h1 className="text-3xl font-bold mb-3 tracking-tight">Qicau: Say it, Save it.</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mb-8 max-w-sm text-lg">
          Catat pengeluaran cukup dengan suara.
        </p>
        
        <div className="flex flex-col gap-3 text-left w-full max-w-sm mb-10">
          <div className="flex items-center gap-4 bg-white/40 dark:bg-neutral-900/40 p-4 rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 backdrop-blur-sm">
             <div className="w-12 h-12 rounded-full bg-[#FBBF24]/10 flex items-center justify-center text-amber-600 dark:text-[#FBBF24] shrink-0"><Mic className="w-6 h-6"/></div>
             <div><p className="font-semibold text-neutral-900 dark:text-white">Input Suara</p><p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">Catat pengeluaran selagi bicara</p></div>
          </div>
          <div className="flex items-center gap-4 bg-white/40 dark:bg-neutral-900/40 p-4 rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 backdrop-blur-sm">
             <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0"><BarChart3 className="w-6 h-6"/></div>
             <div><p className="font-semibold text-neutral-900 dark:text-white">Kategorisasi Pintar</p><p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">Penanda kategori dengan AI</p></div>
          </div>
          <div className="flex items-center gap-4 bg-white/40 dark:bg-neutral-900/40 p-4 rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 backdrop-blur-sm">
             <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shrink-0"><Database className="w-6 h-6"/></div>
             <div><p className="font-semibold text-neutral-900 dark:text-white">Sinkronisasi Google Sheets</p><p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">Ekspor data secara otomatis</p></div>
          </div>
        </div>

        <button
          onClick={login}
          className="bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 px-8 py-4 w-full max-w-sm rounded-[2rem] font-bold text-lg active:scale-95 transition-all flex items-center justify-center gap-3 border border-neutral-200 dark:border-none shadow-sm"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {t.loginBtn}
        </button>

        {/* Global Toast for Logged-Out Screen */}
        {toastMessage && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-100 animate-in slide-in-from-bottom-2 fade-in duration-300">
            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md max-w-[90vw] ${
              toastMessage.type === 'error'
                ? 'bg-red-50/90 dark:bg-red-900/90 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : 'bg-green-50/90 dark:bg-green-900/90 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
            }`}>
              {toastMessage.type === 'error' ? (
                <AlertCircle className="w-5 h-5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              )}
              <p className="text-sm font-medium">{toastMessage.msg}</p>
              <button
                onClick={() => setToastMessage(null)}
                className="ml-2 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-200 dark:bg-[#09090b] transition-colors font-sans flex justify-center">
      <div className="w-full max-w-3xl bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 flex flex-col min-h-screen relative shadow-2xl pb-20 overflow-x-hidden border-x border-neutral-200/50 dark:border-neutral-900">
        <header className="px-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-900 h-16 sticky top-0 bg-neutral-50/80 dark:bg-neutral-950/80 backdrop-blur z-20">
          <div className="flex items-center gap-2 justify-start flex-1">
            <div className="w-7 h-7 rounded-[8px] rotate-3 overflow-hidden flex items-center justify-center">
              <img src="/images/Qicau_Logo.png" alt="Qicau Logo" className="w-full h-full object-cover -rotate-3" />
            </div>
            <span className="font-semibold tracking-tight text-lg">Qicau</span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <PWAInstallButton variant="header" onInstalledSuccess={() => showToast("Aplikasi berhasil dipasang di layar utama!")} />
            <button onClick={() => setShowSettings(true)} className="p-2 -mr-2 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors" title="Pengaturan">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Global Connectivity Offline/Online Banner */}
        <OfflineIndicator />

        {/* PWA New Version Update Prompt */}
        <PWAUpdatePrompt />

        <main className="flex-1 overflow-y-auto">
          {currentTab === "home" && <HomeView user={user} t={t} onViewMore={() => setCurrentTab("history")} />}
          {currentTab === "history" && <HistoryView user={user} t={t} isExporting={isExporting} onExport={exportToSheets} onForceReset={forceResetExport} isRebuildingSummaries={isRebuildingSummaries} onRebuildSummaries={rebuildSummaries} showToast={showToast} />}
          {currentTab === "monthly" && <MonthlyView user={user} t={t} />}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 max-w-3xl mx-auto w-full bg-neutral-50/80 dark:bg-neutral-950/80 backdrop-blur border-t border-x border-t-neutral-200 border-x-neutral-200/50 dark:border-t-neutral-800 dark:border-x-neutral-900 flex justify-around pb-safe pt-2 px-2 z-20 transition-colors">
          <button
            onClick={() => setCurrentTab("home")}
            className={`flex flex-col items-center p-3 w-20 rounded-2xl ${ currentTab === "home" ? "text-amber-600 dark:text-[#FBBF24]" : "text-neutral-600 dark:text-neutral-400" }`}
          >
            <NotebookPen className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">{t.tabRecord}</span>
          </button>
          <button
            onClick={() => setCurrentTab("history")}
            className={`flex flex-col items-center p-3 w-20 rounded-2xl ${ currentTab === "history" ? "text-amber-600 dark:text-[#FBBF24]" : "text-neutral-600 dark:text-neutral-400" }`}
          >
            <History className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">{t.tabHistory}</span>
          </button>
          <button
            onClick={() => setCurrentTab("monthly")}
            className={`flex flex-col items-center p-3 w-20 rounded-2xl ${ currentTab === "monthly" ? "text-amber-600 dark:text-[#FBBF24]" : "text-neutral-600 dark:text-neutral-400" }`}
          >
            <BarChart3 className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">{t.tabMonthly}</span>
          </button>
        </nav>

        {/* Global Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-100 animate-in slide-in-from-bottom-2 fade-in duration-300">
            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md max-w-[90vw] ${
              toastMessage.type === 'error'
                ? 'bg-red-50/90 dark:bg-red-900/90 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : 'bg-green-50/90 dark:bg-green-900/90 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
            }`}>
              {toastMessage.type === 'error' ? (
                <AlertCircle className="w-5 h-5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              )}
              <p className="text-sm font-medium">{toastMessage.msg}</p>
              <button
                onClick={() => setToastMessage(null)}
                className="ml-2 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-start pt-24 sm:pt-0 sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95">
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">Pengaturan</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Tema</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setThemeMode("system")}
                          className={`flex-1 flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-colors ${themeMode === "system" ? "bg-[#FBBF24]/10 border-[#FBBF24]/30 text-amber-600 dark:text-[#FBBF24]" : "bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                        >
                          <Monitor className="w-5 h-5" />
                          <span className="text-xs font-medium">Sistem</span>
                        </button>
                        <button
                          onClick={() => setThemeMode("light")}
                          className={`flex-1 flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-colors ${themeMode === "light" ? "bg-[#FBBF24]/10 border-[#FBBF24]/30 text-amber-600 dark:text-[#FBBF24]" : "bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                        >
                          <Sun className="w-5 h-5" />
                          <span className="text-xs font-medium">Terang</span>
                        </button>
                        <button
                          onClick={() => setThemeMode("dark")}
                          className={`flex-1 flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-colors ${themeMode === "dark" ? "bg-[#FBBF24]/10 border-[#FBBF24]/30 text-amber-600 dark:text-[#FBBF24]" : "bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                        >
                          <Moon className="w-5 h-5" />
                          <span className="text-xs font-medium">Gelap</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <label className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Aplikasi</label>
                      <PWAInstallButton variant="settings" onInstalledSuccess={() => showToast("Aplikasi berhasil dipasang!")} />
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <button
                    onClick={logout}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl font-semibold transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 px-4 py-3 rounded-xl font-semibold transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={showResetConfirm}
          title="Reset Status Ekspor?"
          message="Semua transaksi ditandai belum-terekspor dan dikirim ulang saat sync berikutnya. Baris lama tidak dihapus dulu, jadi bisa ada data ganda di Sheets."
          confirmLabel="Ya, Reset"
          danger
          cooldownMs={1000}
          onConfirm={runForceResetExport}
          onCancel={() => setShowResetConfirm(false)}
        />
        <ConfirmDialog
          open={showSyncConfirm !== false}
          title={showSyncConfirm === "first" ? "Izinkan Akses Google Sheets & Drive" : "Sinkronisasi ke Sheets"}
          message={
            showSyncConfirm === "first"
              ? "Qicau perlu izin membuat dan menulis file spreadsheet di Google Drive kamu untuk menyimpan hasil ekspor. Sebentar lagi muncul jendela izin dari Google, itu normal, tinggal pilih akun dan klik Izinkan."
              : "Sinkronkan transaksi terbaru ke Google Sheets sekarang?"
          }
          confirmLabel={showSyncConfirm === "first" ? "Lanjutkan" : "Sync"}
          onConfirm={runExportToSheets}
          onCancel={() => setShowSyncConfirm(false)}
        />
        <ConfirmDialog
          open={showRebuildConfirm}
          title="Bangun Ulang Ringkasan?"
          message="Ringkasan harian dihitung ulang dari seluruh riwayat transaksi. Berguna kalau angka di tab Ringkasan terasa tidak sesuai."
          confirmLabel="Bangun Ulang"
          onConfirm={runRebuildSummaries}
          onCancel={() => setShowRebuildConfirm(false)}
        />
      </div>
    </div>
  );
}
