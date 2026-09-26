import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Transaction } from "../types";
import { getCategoryIcon } from "./HomeView";
import { Trash2, Loader2, RefreshCw, Filter, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { dict } from "../lib/i18n";

interface HistoryViewProps {
  user: User;
  t: typeof dict["id"];
  isExporting: boolean;
  onExport: () => void;
  onForceReset: () => void;
  showToast: (msg: string, type?: 'success'|'error') => void;
}

export function HistoryView({ user, t, isExporting, onExport, onForceReset, showToast }: HistoryViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterCat, setFilterCat] = useState("All");
  const [filterDate, setFilterDate] = useState("7d");
  const [openCat, setOpenCat] = useState(false);
  const [openDate, setOpenDate] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const itemsPerPage = 30;

  // Build base query constraints with server-side date filter
  const buildBaseConstraints = () => {
    const constraints: any[] = [where("user_id", "==", user.uid)];
    const now = Date.now();
    if (filterDate === "7d") {
      constraints.push(where("created_at", ">=", now - 7 * 24 * 60 * 60 * 1000));
    } else if (filterDate === "30d") {
      constraints.push(where("created_at", ">=", now - 30 * 24 * 60 * 60 * 1000));
    } else if (filterDate === "this_month") {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      constraints.push(where("created_at", ">=", d.getTime()));
    }
    constraints.push(orderBy("created_at", "desc"));
    return constraints;
  };

  // Real-time listener for first page; resets on filter change
  useEffect(() => {
    setIsLoading(true);
    setTransactions([]);
    setLastDoc(null);
    setHasMore(true);
    setCurrentPage(1);

    const q = query(
      collection(db, "transactions"),
      ...buildBaseConstraints(),
      limit(itemsPerPage)
    );

    const unsub = onSnapshot(q, (snap) => {
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(txs);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === itemsPerPage);
      setIsLoading(false);
    }, (err) => {
      console.error(err);
      setIsLoading(false);
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid, filterDate]);

  // Load next chunk of older transactions (one-shot, appends to state)
  const loadMore = async (): Promise<number> => {
    if (!lastDoc || isLoadingMore || !hasMore) return 0;
    setIsLoadingMore(true);
    try {
      const q = query(
        collection(db, "transactions"),
        ...buildBaseConstraints(),
        startAfter(lastDoc),
        limit(itemsPerPage)
      );
      const snap = await getDocs(q);
      const newTxs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(prev => [...prev, ...newTxs]);
      if (snap.docs.length > 0) {
        setLastDoc(snap.docs[snap.docs.length - 1]);
      }
      setHasMore(snap.docs.length === itemsPerPage);
      return snap.docs.length;
    } catch (e: any) {
      console.error(e);
      showToast("Gagal memuat data: " + e.message, 'error');
      return 0;
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (txToDelete) {
      setIsDeleting(true);
      try {
        await deleteDoc(doc(db, "transactions", txToDelete));
        // Manually remove from local state since onSnapshot only tracks first page
        setTransactions(prev => prev.filter(tx => tx.id !== txToDelete));
        setTxToDelete(null);
        if (selectedTx && selectedTx.id === txToDelete) {
          setSelectedTx(null);
        }
      } catch (e) {
        console.error("Gagal menghapus transaksi", e);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const formatIdr = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
  };

  // Category filter (client-side); date filter already applied server-side
  const filteredTxs = transactions.filter(tx =>
    filterCat === "All" || tx.kategori === filterCat
  );

  const cachedPages = Math.max(1, Math.ceil(filteredTxs.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTxs = filteredTxs.slice(startIndex, startIndex + itemsPerPage);

  const goToNextPage = async () => {
    if (currentPage < cachedPages) {
      setCurrentPage(p => p + 1);
      return;
    }
    if (!hasMore) return;
    const newCount = await loadMore();
    if (newCount > 0) {
      setCurrentPage(p => p + 1);
    }
  };

  const PaginationControls = () => {
    const canGoPrev = currentPage > 1;
    const canGoNext = currentPage < cachedPages || (hasMore && !isLoadingMore);

    return (
      <div className="flex justify-center items-center gap-4 mt-2 mb-2">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={!canGoPrev || isLoadingMore}
          className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
        </button>
        <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {currentPage} / {cachedPages + (hasMore ? 1 : 0)}
        </span>
        <button
          onClick={goToNextPage}
          disabled={!canGoNext || isLoadingMore}
          className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoadingMore ? (
            <Loader2 className="w-5 h-5 text-neutral-600 dark:text-neutral-400 animate-spin" />
          ) : (
            <ChevronRight className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          )}
        </button>
      </div>
    );
  };

  // Group by day
  const grouped: Record<string, Transaction[]> = {};
  paginatedTxs.forEach(t_item => {
    const date = new Date(t_item.created_at);
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const dateStr = `${day} ${t.monthLabels[month as keyof typeof t.monthLabels]} ${year}`;
    let key = dateStr;
    
    // Check if today or yesterday
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) key = "Hari Ini";
    else if (date.toDateString() === yesterday.toDateString()) key = "Kemarin";

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t_item);
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white shrink-0 leading-tight">
          <span className="block sm:hidden">
            {t.transactionHistory.split(' ').map((word, i, arr) => (
              <span key={i}>{word}{i < arr.length - 1 && <br />}</span>
            ))}
          </span>
          <span className="hidden sm:block">{t.transactionHistory}</span>
        </h2>
        {transactions.length > 0 && (
          <div className="flex flex-col-reverse sm:flex-row items-end sm:items-center gap-2">
            <button
              onClick={onForceReset}
              disabled={isExporting}
              className={`text-xs bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 py-1.5 px-3 rounded-lg transition-colors border border-red-500/20 flex items-center justify-center min-w-[90px] w-full sm:w-auto ${isExporting ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              Reset Ekspor
            </button>
            <button
              onClick={onExport}
              disabled={isExporting}
              className={`text-xs bg-[#FBBF24]/10 hover:bg-[#FBBF24]/20 text-yellow-600 dark:text-[#FBBF24] py-1.5 px-3 rounded-lg transition-colors border border-[#FBBF24]/20 flex items-center justify-center gap-1.5 min-w-[130px] w-full sm:w-auto ${isExporting ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="truncate">Menyinkronkan...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync ke Sheets
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-6 relative">
        <div className="relative">
          <button 
            onClick={() => { setOpenCat(!openCat); setOpenDate(false); }}
            className="flex items-center justify-between gap-2 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-sm border border-neutral-200/50 dark:border-neutral-800/50 hover:bg-white/60 dark:hover:bg-neutral-900/60 transition-colors rounded-lg px-3 py-2 shrink-0 text-sm text-neutral-900 dark:text-neutral-300 w-40"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Filter className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
              <span className="truncate">{filterCat === "All" ? "Semua Kategori" : t.categories[filterCat as keyof typeof t.categories]}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
          </button>
          
          {openCat && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenCat(false)} />
              <div className="absolute top-full left-0 mt-2 w-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-neutral-200/50 dark:border-neutral-800/50 rounded-xl overflow-hidden shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col p-1">
                <button
                  className={`text-left px-3 py-2 text-sm rounded-lg transition-colors truncate ${filterCat === "All" ? "bg-[#FBBF24]/10 text-amber-600 dark:text-[#FBBF24] font-medium" : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50"}`}
                  onClick={() => { setFilterCat("All"); setOpenCat(false); setCurrentPage(1); }}
                >
                  Semua Kategori
                </button>
                {Object.entries(t.categories).map(([k, v]) => (
                  <button
                    key={k}
                    className={`text-left px-3 py-2 text-sm rounded-lg transition-colors truncate ${filterCat === k ? "bg-[#FBBF24]/10 text-amber-600 dark:text-[#FBBF24] font-medium" : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50"}`}
                    onClick={() => { setFilterCat(k); setOpenCat(false); setCurrentPage(1); }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button 
            onClick={() => { setOpenDate(!openDate); setOpenCat(false); }}
            className="flex items-center justify-between gap-1.5 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-sm border border-neutral-200/50 dark:border-neutral-800/50 hover:bg-white/60 dark:hover:bg-neutral-900/60 transition-colors rounded-lg px-2.5 py-2 shrink-0 text-sm text-neutral-900 dark:text-neutral-300 w-[130px]"
          >
            <span className="truncate">
              {filterDate === "All" ? "Semua Waktu" : filterDate === "7d" ? "7 Hari Terakhir" : filterDate === "30d" ? "30 Hari Terakhir" : "Bulan Ini"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
          </button>

          {openDate && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenDate(false)} />
              <div className="absolute top-full left-0 mt-2 w-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-neutral-200/50 dark:border-neutral-800/50 rounded-xl overflow-hidden shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col p-1">
                {[
                  { value: "All", label: "Semua Waktu" },
                  { value: "7d", label: "7 Hari Terakhir" },
                  { value: "30d", label: "30 Hari Terakhir" },
                  { value: "this_month", label: "Bulan Ini" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    className={`text-left px-3 py-2 text-sm rounded-lg transition-colors truncate ${filterDate === opt.value ? "bg-[#FBBF24]/10 text-amber-600 dark:text-[#FBBF24] font-medium" : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50"}`}
                    onClick={() => { setFilterDate(opt.value); setOpenDate(false); setCurrentPage(1); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex flex-col gap-6">
          <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-900 rounded animate-pulse"></div>
          <div className="flex flex-col gap-3">
             {[1,2,3,4,5].map(i => (
                <div key={i} className="flex justify-between items-center bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-none rounded-2xl p-4 animate-pulse">
                  <div className="flex flex-1 gap-3 items-center">
                    <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-full shrink-0"></div>
                    <div className="flex flex-col gap-2">
                       <div className="h-4 w-24 bg-neutral-100 dark:bg-neutral-800 rounded"></div>
                       <div className="h-3 w-16 bg-neutral-100 dark:bg-neutral-800 rounded"></div>
                    </div>
                  </div>
                </div>
             ))}
          </div>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400 text-center mt-10">{t.noHistory}</p>
      ) : (
        <div className="flex flex-col gap-6">
          <PaginationControls />
          {Object.entries(grouped).map(([dateLabel, txs]) => (
            <div key={dateLabel}>
              <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-3">{dateLabel}</h3>
              <div className="flex flex-col gap-3">
                {txs.map(tx => (
                  <div 
                    key={tx.id} 
                    onClick={() => setSelectedTx(tx)}
                    className="flex justify-between items-center bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-none shadow-sm dark:shadow-none rounded-2xl p-4 group cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <div className="flex flex-1 min-w-0 gap-3 items-center">
                      <div className="w-10 h-10 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-none rounded-full flex items-center justify-center text-xl shrink-0">
                        {getCategoryIcon(tx.kategori)}
                      </div>
                      <div className="min-w-0 pr-4">
                        <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">{tx.platform || t.categories[tx.kategori as keyof typeof t.categories] || tx.kategori}</p>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{t.categories[tx.kategori as keyof typeof t.categories] || tx.kategori} • {tx.payment_method}</p>
                        {tx.detail && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">{tx.detail}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="font-mono text-sm font-medium text-red-500 dark:text-red-400">
                        -{formatIdr(tx.harga).replace("Rp", "").trim()}
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setTxToDelete(tx.id); }}
                        className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-red-500 bg-neutral-50 hover:bg-red-50 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <PaginationControls />
        </div>
      )}

      {selectedTx && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="font-semibold text-neutral-900 dark:text-white">Detail Pengeluaran</h3>
              <button 
                onClick={() => setSelectedTx(null)}
                className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 bg-neutral-100/50 hover:bg-neutral-200/50 dark:bg-neutral-800/50 dark:hover:bg-neutral-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-6">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-none rounded-full flex items-center justify-center text-3xl">
                  {getCategoryIcon(selectedTx.kategori)}
                </div>
                <div className="text-center">
                  <h4 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">
                    {selectedTx.platform || t.categories[selectedTx.kategori as keyof typeof t.categories] || selectedTx.kategori}
                  </h4>
                  <p className="text-2xl font-mono font-semibold text-red-500 dark:text-red-400">
                    -{formatIdr(selectedTx.harga)}
                  </p>
                </div>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Kategori</span>
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">{t.categories[selectedTx.kategori as keyof typeof t.categories] || selectedTx.kategori}</span>
                </div>
                
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Metode Pembayaran</span>
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">{selectedTx.payment_method}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Waktu</span>
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">
                    {new Date(selectedTx.created_at).toLocaleString('id-ID', {
                      dateStyle: 'full',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>

                {selectedTx.detail && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Catatan</span>
                    <span className="text-sm font-medium text-neutral-900 dark:text-white break-words">{selectedTx.detail}</span>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => {
                  setTxToDelete(selectedTx.id);
                }}
                className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Hapus Transaksi
              </button>
            </div>
          </div>
        </div>
      )}

      {txToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 flex flex-col gap-6 text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-2">
              <Trash2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Hapus Transaksi?</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Tindakan ini tidak dapat dibatalkan. Transaksi ini akan dihapus dari riwayat dan perhitungan bulanan Anda.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setTxToDelete(null)}
                className="flex-1 py-3 px-4 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className={`flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center ${isDeleting ? 'opacity-80 cursor-not-allowed' : ''}`}
              >
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
