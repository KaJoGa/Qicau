import React, { useState, useRef, useEffect } from "react";
import { User } from "firebase/auth";
import { Mic, MicOff, Check, Loader2, Undo2, Pencil, X, ChevronDown } from "lucide-react";
import { AudioRecorder, playBeep } from "../lib/audio";
import { ParsedTransaction, Transaction } from "../types";
import { setDoc, collection, doc, deleteDoc, query, where, orderBy, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { dict } from "../lib/i18n";

const CATEGORY_OPTIONS = [
  { value: "Makan", label: "Makan", icon: "🍽️" },
  { value: "Jajan", label: "Jajan", icon: "🍦" },
  { value: "Transport", label: "Transport", icon: "🚗" },
  { value: "Belanja", label: "Belanja", icon: "🛒" },
  { value: "Tagihan", label: "Tagihan", icon: "🧾" },
  { value: "Lainnya", label: "Lainnya", icon: "💡" },
];

const PAYMENT_OPTIONS = [
  { value: "QRIS", label: "QRIS" },
  { value: "Cash", label: "Cash" },
  { value: "Transfer", label: "Transfer" },
  { value: "GoPay", label: "GoPay" },
  { value: "OVO", label: "OVO" },
  { value: "DANA", label: "DANA" },
  { value: "ShopeePay", label: "ShopeePay" },
  { value: "Kartu", label: "Kartu" },
  { value: "Paylater", label: "Paylater" },
];

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; icon?: string }[];
  placeholder?: string;
  required?: boolean;
}

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQueryText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cur = options.find((o) => o.value.toLowerCase() === (value || "").toLowerCase());
    setQueryText(cur ? cur.label : value || "");
  }, [value, options]);

  const commitSelection = (textToMatch: string) => {
    const trimmed = textToMatch.trim();
    if (!trimmed) {
      const cur = options.find((o) => o.value.toLowerCase() === (value || "").toLowerCase());
      setQueryText(cur ? cur.label : value || "");
      setIsOpen(false);
      return;
    }

    // 1. Exact case-insensitive match
    const exact = options.find(
      (o) => o.value.toLowerCase() === trimmed.toLowerCase() || o.label.toLowerCase() === trimmed.toLowerCase()
    );
    if (exact) {
      onChange(exact.value);
      setQueryText(exact.label);
      setIsOpen(false);
      return;
    }

    // 2. Starts with query (e.g. "pay" -> "Paylater")
    const startsWith = options.find(
      (o) =>
        o.value.toLowerCase().startsWith(trimmed.toLowerCase()) ||
        o.label.toLowerCase().startsWith(trimmed.toLowerCase())
    );
    if (startsWith) {
      onChange(startsWith.value);
      setQueryText(startsWith.label);
      setIsOpen(false);
      return;
    }

    // 3. Substring match
    const matches = options.filter(
      (o) =>
        o.value.toLowerCase().includes(trimmed.toLowerCase()) ||
        o.label.toLowerCase().includes(trimmed.toLowerCase())
    );
    if (matches.length > 0) {
      onChange(matches[0].value);
      setQueryText(matches[0].label);
      setIsOpen(false);
      return;
    }

    // Fallback: restore current value
    const cur = options.find((o) => o.value.toLowerCase() === (value || "").toLowerCase());
    setQueryText(cur ? cur.label : value || "");
    setIsOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        commitSelection(queryText);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, queryText, value, options]);

  const currentOpt = options.find((o) => o.value.toLowerCase() === (value || "").toLowerCase());
  const isTyping = queryText !== (currentOpt ? currentOpt.label : value);

  // If user just opened without modifying text, show all options.
  // If user typed something new, filter based on queryText.
  const filteredOptions = isTyping && queryText.trim() !== ""
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(queryText.trim().toLowerCase()) ||
          o.value.toLowerCase().includes(queryText.trim().toLowerCase())
      )
    : options;

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5 block">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={queryText}
          onFocus={(e) => {
            setIsOpen(true);
            e.target.select();
          }}
          onClick={() => {
            setIsOpen(true);
          }}
          onChange={(e) => {
            setQueryText(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitSelection(queryText);
            } else if (e.key === "Escape") {
              setIsOpen(false);
              const cur = options.find((o) => o.value.toLowerCase() === (value || "").toLowerCase());
              setQueryText(cur ? cur.label : value || "");
            }
          }}
          placeholder={placeholder}
          required={required}
          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 pr-10 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-[#FBBF24] transition-colors text-sm"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (isOpen) {
              commitSelection(queryText);
            } else {
              setIsOpen(true);
              inputRef.current?.focus();
            }
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl max-h-48 overflow-y-auto p-1 animate-in fade-in zoom-in-95 duration-100">
          {filteredOptions.length === 0 ? (
            <div className="py-2.5 px-3 text-xs text-neutral-400 dark:text-neutral-500 text-center">
              Tidak ada hasil ditemukan
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = opt.value.toLowerCase() === (value || "").toLowerCase();
              return (
                <button
                  key={opt.value}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(opt.value);
                    setQueryText(opt.label);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                    isSelected
                      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-[#FBBF24] font-semibold"
                      : "text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {opt.icon && <span className="text-base">{opt.icon}</span>}
                    <span>{opt.label}</span>
                  </span>
                  {isSelected && <Check className="w-4 h-4 shrink-0 text-amber-500 dark:text-[#FBBF24]" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function HomeView({ user, t, onViewMore }: { user: User; t: typeof dict["id"], onViewMore?: () => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualMode, setManualMode] = useState<"ai" | "direct">("ai");
  const [manualText, setManualText] = useState("");
  const [directHarga, setDirectHarga] = useState<number | "">("");
  const [directPlatform, setDirectPlatform] = useState("");
  const [directKategori, setDirectKategori] = useState("Makan");
  const [directPaymentMethod, setDirectPaymentMethod] = useState("QRIS");
  const [directDetail, setDirectDetail] = useState("");
  const [volume, setVolume] = useState(0);
  const [toast, setToast] = useState<{ id: string, tx: ParsedTransaction, dbId: string } | null>(null);
  const [editingTx, setEditingTx] = useState<{ id: string, tx: ParsedTransaction } | null>(null);
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const recordingStartTimeRef = useRef(0);
  const isRecordingRef = useRef(false);
  const recordingMaxTimerRef = useRef<number | null>(null);
  const [showLowConfidence, setShowLowConfidence] = useState(false);

  const MAX_RECORDING_MS = 60000; // 1 min hard cap (well under Gemini TPM 250K free tier)

  useEffect(() => {
    // Fetch today's transactions for the user
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, "transactions"),
      where("user_id", "==", user.uid),
      where("created_at", ">=", startOfToday.getTime()),
      orderBy("created_at", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setRecentTxs(txs.slice(0, 3));
      const total = txs.reduce((sum, t) => sum + (t.harga || 0), 0);
      setTodayTotal(total);
      setIsLoadingRecent(false);
    }, (err) => {
      console.error(err);
      setIsLoadingRecent(false);
    });

    return unsub;
  }, [user.uid]);

  const startRecording = async () => {
    if (!navigator.onLine) {
      alert("Mode Offline: Perekaman suara dengan AI membutuhkan koneksi internet. Silakan gunakan tombol 'Input Manual' untuk mencatat transaksi saat offline.");
      return;
    }
    try {
      if (toast) setToast(null); // Clear active toast
      recorderRef.current = new AudioRecorder();
      recordingStartTimeRef.current = Date.now();
      isRecordingRef.current = true;
      setIsRecording(true);
      playBeep('start');

      // Hard cap: auto-stop after MAX_RECORDING_MS to prevent runaway recordings
      recordingMaxTimerRef.current = window.setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_MS);

      await recorderRef.current.start(
        (vol) => setVolume(vol),
        () => stopRecording() // auto stop on silence
      );
    } catch (e) {
      console.error(e);
      isRecordingRef.current = false;
      setIsRecording(false);
      if (recordingMaxTimerRef.current) {
        clearTimeout(recordingMaxTimerRef.current);
        recordingMaxTimerRef.current = null;
      }
      alert("Membutuhkan akses mikrofon.");
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current || !isRecordingRef.current) return;
    isRecordingRef.current = false;
    if (recordingMaxTimerRef.current) {
      clearTimeout(recordingMaxTimerRef.current);
      recordingMaxTimerRef.current = null;
    }
    setIsRecording(false);
    setIsProcessing(true);
    setVolume(0);
    playBeep('stop');

    const duration = Date.now() - recordingStartTimeRef.current;
    
    const { base64, mimeType } = await recorderRef.current.stop();
    
    // Ignore accidental clicks / super short recordings
    if (!base64 || duration < 800) {
      setIsProcessing(false);
      return;
    }

    try {
      const resp = await fetch("/api/parse-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64, mimeType })
      });
      let data;
      try {
        const text = await resp.text();
        data = JSON.parse(text);
      } catch (err) {
        throw new Error(!resp.ok ? `Server error: ${resp.status}` : "Invalid response format from server");
      }
      
      if (!resp.ok) {
        throw new Error(data?.error || "Server error");
      }

      const parsedStr = data.result.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed: ParsedTransaction = JSON.parse(parsedStr);

      if (parsed.confidence === "low") {
        saveLowConfidenceLog(parsed, "voice");
        setIsProcessing(false);
        setShowLowConfidence(true);
        return;
      }

      // Save to Firebase
      const newDocId = saveToDb(parsed);

      const newToastId = Date.now().toString();
      setToast({ id: newToastId, tx: parsed, dbId: newDocId });

      // Auto dismiss toast
      setTimeout(() => {
        setToast((curr) => curr?.id === newToastId ? null : curr);
      }, 5000);

    } catch (e: any) {
      console.error(e);
      alert("Gagal memproses suara. " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveToDb = (tx: ParsedTransaction) => {
    const docRef = doc(collection(db, "transactions"));
    setDoc(docRef, {
      ...tx,
      user_id: user.uid,
      created_at: Date.now()
    }).catch((e: any) => {
      console.error("Firebase write err", e);
      alert("Firebase write error: " + e.message);
    });
    return docRef.id;
  };

  const saveLowConfidenceLog = (parsed: ParsedTransaction, source: "voice" | "text", inputText?: string) => {
    const docRef = doc(collection(db, "low_confidence_logs"));
    setDoc(docRef, {
      user_id: user.uid,
      attempted_at: Date.now(),
      source,
      ...(inputText !== undefined ? { input_text: inputText } : {}),
      raw_transcript: parsed.raw_transcript || "",
      gemini_output: parsed,
    }).catch((e: any) => {
      console.error("Low-confidence log write err", e);
    });
  };

  const parseManualText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) {
      alert("Mode Offline: Pemrosesan teks dengan AI memerlukan koneksi internet. Silakan pilih tab 'Formulir Langsung' untuk mencatat transaksi saat offline.");
      return;
    }
    const trimmed = manualText.trim().slice(0, 500);
    if (!trimmed) return;

    setIsManualInput(false);
    setIsProcessing(true);

    try {
      if (toast) setToast(null);
      const resp = await fetch("/api/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textInput: trimmed })
      });
      let data;
      try {
        const text = await resp.text();
        data = JSON.parse(text);
      } catch (err) {
        throw new Error(!resp.ok ? `Server error: ${resp.status}` : "Invalid response format from server");
      }
      
      if (!resp.ok) {
        throw new Error(data?.error || "Server error");
      }

      const parsedStr = data.result.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed: ParsedTransaction = JSON.parse(parsedStr);

      if (parsed.confidence === "low") {
        saveLowConfidenceLog(parsed, "text", manualText);
        setIsProcessing(false);
        setShowLowConfidence(true);
        return;
      }

      // Save to Firebase
      const newDocId = saveToDb(parsed);

      const newToastId = Date.now().toString();
      setToast({ id: newToastId, tx: parsed, dbId: newDocId });
      setManualText(""); // Clear manual input text
      
      // Auto dismiss toast
      setTimeout(() => {
        setToast((curr) => curr?.id === newToastId ? null : curr);
      }, 5000);

    } catch (e: any) {
      console.error(e);
      alert("Gagal memproses teks. " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveDirectTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directHarga || Number(directHarga) <= 0) {
      alert("Harap masukkan jumlah pengeluaran.");
      return;
    }
    const numHarga = Math.min(Number(directHarga), 999999999);
    const parsed: ParsedTransaction = {
      kategori: directKategori || "Lainnya",
      platform: directPlatform.trim(),
      harga: numHarga,
      detail: directDetail.trim() || directPlatform.trim() || directKategori,
      payment_method: directPaymentMethod || "QRIS",
      confidence: "high",
      raw_transcript: `Input Manual: ${directPlatform || directKategori} ${numHarga}`,
    };

    const newDocId = saveToDb(parsed);
    const newToastId = Date.now().toString();
    setToast({ id: newToastId, tx: parsed, dbId: newDocId });
    setIsManualInput(false);
    setDirectHarga("");
    setDirectPlatform("");
    setDirectDetail("");

    setTimeout(() => {
      setToast((curr) => (curr?.id === newToastId ? null : curr));
    }, 5000);
  };

  const undoTransaction = (dbId: string) => {
    setToast(null);
    deleteDoc(doc(db, "transactions", dbId)).catch((e) => {
      console.error(e);
      alert("Gagal undo");
    });
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    
    updateDoc(doc(db, "transactions", editingTx.id), {
      ...editingTx.tx
    }).catch((err: any) => {
      console.error(err);
      alert("Gagal menyimpan perubahan: " + err.message);
    });
    
    setEditingTx(null);
  };

  const formatIdr = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="flex flex-col items-center p-6 h-full relative">
      
      {/* Top Section: Today's Total */}
      <div className="w-full max-w-sm mt-4 mb-4 text-center shrink-0">
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-1">{t.todayExpenses}</p>
        <h2 className="text-4xl font-bold text-neutral-900 dark:text-white tracking-tight break-all">{formatIdr(todayTotal)}</h2>
      </div>

      {/* Center: Record Button */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[220px]">
        <div className="relative">
          {isRecording && (
            <div 
              className="absolute inset-0 bg-[#FBBF24] rounded-full opacity-20 blur-xl transition-all duration-75"
              style={{ transform: `scale(${1 + volume * 1.5})` }}
            />
          )}

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`relative w-40 h-40 rounded-full flex items-center justify-center shadow-2xl transition-all ${
              isRecording 
                ? "bg-red-500 shadow-red-500/20 active:scale-95" 
                : isProcessing 
                ? "bg-neutral-800" 
                : "bg-[#FBBF24] hover:bg-[#FBBF24]/90 shadow-[#FBBF24]/20 active:scale-95"
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-16 h-16 text-white animate-spin" />
            ) : isRecording ? (
              <div className="flex items-center justify-center w-full h-full">
                <div className="w-12 h-12 bg-white rounded-md animate-pulse"></div>
              </div>
            ) : (
              <Mic className="w-16 h-16 text-neutral-900" />
            )}
          </button>
        </div>
        
        <p className="mt-8 text-neutral-500 dark:text-neutral-400 font-medium h-6">
          {isProcessing ? t.processing : isRecording ? t.listening : t.tapToSpeak}
        </p>

        {/* Manual Input Button */}
        {!isRecording && !isProcessing && (
          <button 
            onClick={() => {
              if (!navigator.onLine) {
                setManualMode("direct");
              }
              setIsManualInput(true);
            }}
            className="mt-6 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-200 border border-neutral-700/50 hover:border-neutral-500 hover:bg-neutral-800/50 px-4 py-1.5 rounded-full transition-all"
          >
            {t.manualInput}
          </button>
        )}
      </div>

      {/* Bottom: Recent Txs */}
      <div className="w-full max-w-sm mt-8 mb-10 shrink-0">
        <div className="flex items-center justify-between mb-4">
           <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">{t.recent}</h3>
        </div>
        <div className="flex flex-col gap-3">
          {isLoadingRecent ? (
            // Skeleton Loader
            [1, 2, 3].map(i => (
              <div key={i} className="flex justify-between items-center bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-none rounded-2xl p-4 animate-pulse">
                <div className="flex flex-1 min-w-0 gap-3 items-center">
                  <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-full shrink-0"></div>
                  <div className="flex-1 min-w-0 pr-4 flex flex-col gap-2">
                    <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-24"></div>
                    <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-16"></div>
                  </div>
                </div>
                <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-12 shrink-0"></div>
              </div>
            ))
          ) : recentTxs.length === 0 ? (
             <p className="text-neutral-600 dark:text-neutral-400 text-sm text-center italic py-2">{t.noTxsToday}</p>
          ) : (
            <>
              {recentTxs.map(tx => (
                <div key={tx.id} className="flex justify-between items-center bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-none shadow-sm dark:shadow-none rounded-2xl p-4">
                  <div className="flex flex-1 min-w-0 gap-3 items-center">
                    <div className="w-10 h-10 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-none rounded-full flex items-center justify-center text-xl shrink-0">
                      {getCategoryIcon(tx.kategori)}
                    </div>
                    <div className="min-w-0 pr-4">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">{tx.platform || t.categories[tx.kategori as keyof typeof t.categories] || tx.kategori}</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{t.categories[tx.kategori as keyof typeof t.categories] || tx.kategori} • {tx.payment_method}</p>
                    </div>
                  </div>
                  <div className="font-mono text-sm font-medium text-red-500 dark:text-red-400 shrink-0">
                    -{formatIdr(tx.harga).replace("Rp", "").trim()}
                  </div>
                </div>
              ))}
              {onViewMore && (
                <button 
                  onClick={onViewMore}
                  className="mt-2 text-sm text-center font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white underline underline-offset-4 decoration-neutral-300 dark:decoration-neutral-700 hover:decoration-neutral-900 dark:hover:decoration-neutral-300 transition-colors"
                >
                  Lihat Semua
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-4 right-4 max-w-md mx-auto bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 flex flex-col animate-in slide-in-from-top-5 z-50 overflow-hidden">
          <button 
            onClick={() => setToast(null)}
            className="absolute top-2 right-2 p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 bg-neutral-100/50 hover:bg-neutral-200/50 dark:bg-neutral-700/30 dark:hover:bg-neutral-700/60 rounded-full transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="p-4 flex flex-col gap-3 mt-1">
            <div className="flex items-start gap-3 pr-6">
              <div className="w-8 h-8 rounded-full bg-[#FBBF24]/20 text-amber-600 dark:text-[#FBBF24] flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{t.saved}: {toast.tx.platform || t.categories[toast.tx.kategori as keyof typeof t.categories] || toast.tx.kategori}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{t.categories[toast.tx.kategori as keyof typeof t.categories] || toast.tx.kategori} • {formatIdr(toast.tx.harga)}</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate mt-0.5">{toast.tx.detail}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-100 dark:border-neutral-700 pt-3">
              <button 
                onClick={() => {
                  setEditingTx({ id: toast.dbId, tx: toast.tx });
                  setToast(null);
                }} 
                className="px-3 py-1.5 flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg text-sm font-medium transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> {t.editTx}
              </button>
              <button 
                onClick={() => undoTransaction(toast.dbId)}
                className="px-3 py-1.5 flex items-center gap-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" /> {t.undo}
              </button>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="h-1 bg-neutral-700 w-full">
            <div className="h-full bg-[#FBBF24]" style={{ animation: "shrink 5s linear forwards" }}></div>
          </div>
        </div>
      )}

      {/* Low Confidence Modal */}
      {showLowConfidence && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 flex flex-col gap-6 text-center">
            <div className="mx-auto w-16 h-16 bg-amber-50 dark:bg-amber-500/10 rounded-full flex items-center justify-center text-amber-600 dark:text-[#FBBF24] mb-2">
              <MicOff className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Suara Kurang Jelas</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Kami tidak menangkap detail transaksi dengan jelas. Coba ulangi lagi atau gunakan Input Manual.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowLowConfidence(false);
                  setIsManualInput(true);
                }}
                className="flex-1 py-3 px-4 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl transition-colors"
              >
                Input Manual
              </button>
              <button
                onClick={() => setShowLowConfidence(false)}
                className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Input Modal */}
      {isManualInput && (
        <div className="fixed inset-0 z-50 flex items-start pt-16 sm:items-center sm:pt-0 justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 leading-none overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{t.manualInput}</h3>
              <button 
                onClick={() => setIsManualInput(false)}
                className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white p-2 -mr-2 bg-neutral-100 dark:bg-neutral-800/50 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-neutral-100 dark:bg-neutral-800/60 p-1 rounded-2xl mb-5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setManualMode("ai")}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  manualMode === "ai"
                    ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                Teks AI
              </button>
              <button
                type="button"
                onClick={() => setManualMode("direct")}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  manualMode === "direct"
                    ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                Formulir Langsung {!navigator.onLine && <span className="text-[10px] text-amber-500 ml-1">(Offline)</span>}
              </button>
            </div>

            {manualMode === "ai" ? (
              <form onSubmit={parseManualText} className="flex flex-col gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block">
                      {t.manualInput}
                    </label>
                    <span className={`text-[10px] font-medium ${manualText.length >= 500 ? 'text-red-500 font-bold' : 'text-neutral-400 dark:text-neutral-500'}`}>
                      {manualText.length}/500
                    </span>
                  </div>
                  <textarea 
                    value={manualText}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setManualText(e.target.value);
                      }
                    }}
                    maxLength={500}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-[#FBBF24] transition-colors resize-none h-32 text-sm leading-normal"
                    placeholder={t.manualInputPlaceholder}
                    required
                    autoFocus
                  />
                  {!navigator.onLine && (
                    <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                      Anda sedang offline. Beralih ke tab <strong>Formulir Langsung</strong> untuk menyimpan secara lokal.
                    </p>
                  )}
                </div>

                <div className="flex gap-3 justify-end mt-2">
                  <button 
                    type="button"
                    onClick={() => setIsManualInput(false)}
                    className="px-5 py-2.5 rounded-xl font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button 
                    type="submit" 
                    disabled={isProcessing}
                    className="flex-1 bg-[#FBBF24] hover:bg-[#FBBF24]/90 text-black font-bold py-2.5 rounded-xl transition-colors active:scale-95 flex items-center justify-center"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : t.submit}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={saveDirectTx} className="flex flex-col gap-4 pb-2">
                <div>
                  <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block mb-1.5">
                    {t.price} (Rp) *
                  </label>
                  <input 
                    type="text" 
                    value={directHarga ? formatIdr(Number(directHarga)).replace("Rp", "").trim() : ""} 
                    onChange={(e) => {
                      const rawVal = e.target.value.replace(/\D/g, "");
                      if (!rawVal) {
                        setDirectHarga("");
                        return;
                      }
                      let num = parseInt(rawVal, 10);
                      if (num > 999999999 || rawVal.length >= 10) {
                        num = 999999999;
                      }
                      setDirectHarga(num);
                    }}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-[#FBBF24] transition-colors text-sm"
                    placeholder="Contoh: 25.000"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block mb-1.5">
                    {t.platformName}
                  </label>
                  <input 
                    type="text" 
                    value={directPlatform} 
                    onChange={(e) => setDirectPlatform(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-[#FBBF24] transition-colors text-sm"
                    placeholder="Contoh: Warmindo, Indomaret"
                  />
                </div>

                <SearchableSelect
                  label={t.category}
                  value={directKategori}
                  onChange={(val) => setDirectKategori(val)}
                  options={CATEGORY_OPTIONS}
                  placeholder="Pilih atau cari kategori"
                  required
                />

                <SearchableSelect
                  label={t.paymentMethod}
                  value={directPaymentMethod}
                  onChange={(val) => setDirectPaymentMethod(val)}
                  options={PAYMENT_OPTIONS}
                  placeholder="Pilih atau cari metode pembayaran"
                  required
                />

                <div>
                  <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block mb-1.5">
                    {t.additionalNotes} ({t.optional})
                  </label>
                  <input 
                    type="text" 
                    value={directDetail} 
                    onChange={(e) => setDirectDetail(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-[#FBBF24] transition-colors text-sm"
                    placeholder="Contoh: Makan siang, kopi susu"
                  />
                </div>

                <div className="flex gap-3 justify-end mt-3">
                  <button 
                    type="button"
                    onClick={() => setIsManualInput(false)}
                    className="px-5 py-2.5 rounded-xl font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 bg-[#FBBF24] hover:bg-[#FBBF24]/90 text-black font-bold py-2.5 rounded-xl transition-colors active:scale-95 flex items-center justify-center text-sm"
                  >
                    Simpan Transaksi
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-start pt-16 sm:items-center sm:pt-0 justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 leading-none overflow-y-auto max-h-[85vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{t.editTx}</h3>
              <button 
                onClick={() => setEditingTx(null)}
                className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white p-2 -mr-2 bg-neutral-100 dark:bg-neutral-800/50 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={saveEdit} className="flex flex-col gap-4 pb-6">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block">{t.platformName}</label>
                  <span className={`text-[10px] font-medium ${(editingTx.tx.platform?.length || 0) >= 50 ? 'text-red-500' : 'text-neutral-400 dark:text-neutral-500'}`}>
                    {(editingTx.tx.platform?.length || 0)}/50
                  </span>
                </div>
                <input 
                  type="text" 
                  value={editingTx.tx.platform || ""} 
                  onChange={(e) => setEditingTx({ ...editingTx, tx: { ...editingTx.tx, platform: e.target.value }})}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-[#FBBF24] transition-colors"
                  placeholder={t.egGojek}
                  maxLength={50}
                  required
                />
              </div>

              <div>
                <SearchableSelect
                  label={t.category}
                  value={editingTx.tx.kategori || "Lainnya"}
                  onChange={(val) => setEditingTx({ ...editingTx, tx: { ...editingTx.tx, kategori: val }})}
                  options={CATEGORY_OPTIONS}
                  placeholder="Ketik atau pilih kategori..."
                  required
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block">{t.price}</label>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Maks Rp 999.999.999</span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-neutral-500 dark:text-neutral-400 font-medium">Rp</span>
                  <input 
                    type="number" 
                    max={999999999}
                    value={editingTx.tx.harga === 0 ? "" : editingTx.tx.harga} 
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setEditingTx({ ...editingTx, tx: { ...editingTx.tx, harga: 0 }});
                        return;
                      }
                      let num = parseInt(raw, 10);
                      if (isNaN(num)) num = 0;
                      // When user inputs 1 billion or more (10th digit entered, 9 digits safe), cap to 999.999.999
                      if (num >= 1000000000 || raw.length >= 10) {
                        num = 999999999;
                      } else if (num < 0) {
                        num = 0;
                      }
                      setEditingTx({ ...editingTx, tx: { ...editingTx.tx, harga: num }});
                    }}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-[#FBBF24] transition-colors font-mono"
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div>
                <SearchableSelect
                  label={t.paymentMethod}
                  value={editingTx.tx.payment_method || "QRIS"}
                  onChange={(val) => setEditingTx({ ...editingTx, tx: { ...editingTx.tx, payment_method: val }})}
                  options={PAYMENT_OPTIONS}
                  placeholder="Ketik atau pilih metode..."
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block">{t.additionalNotes}</label>
                  <span className={`text-[10px] font-medium ${(editingTx.tx.detail?.length || 0) >= 200 ? 'text-red-500' : 'text-neutral-400 dark:text-neutral-500'}`}>
                    {(editingTx.tx.detail?.length || 0)}/200
                  </span>
                </div>
                <input 
                  type="text" 
                  value={editingTx.tx.detail || ""} 
                  onChange={(e) => setEditingTx({ ...editingTx, tx: { ...editingTx.tx, detail: e.target.value }})}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-[#FBBF24] transition-colors"
                  placeholder={t.optional}
                  maxLength={200}
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-[#FBBF24] hover:bg-[#FBBF24]/90 text-black font-bold py-3.5 rounded-xl transition-colors active:scale-95 mt-4"
              >
                {t.saveChanges}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function getCategoryIcon(kat: string) {
  switch (kat.toLowerCase()) {
    case "makan": return "🍽️";
    case "jajan": return "🍦";
    case "transport": return "🚗";
    case "belanja": return "🛒";
    case "tagihan": return "🧾";
    default: return "💡";
  }
}
