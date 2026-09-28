import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  cooldownMs?: number;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Custom-styled stand-in for window.confirm, with an optional short cooldown
// on the confirm button to prevent accidental/rapid clicks on riskier actions.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  cooldownMs = 0,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [locked, setLocked] = useState(cooldownMs > 0);

  useEffect(() => {
    if (!open) return;
    setLocked(cooldownMs > 0);
    if (cooldownMs > 0) {
      const timer = setTimeout(() => setLocked(false), cooldownMs);
      return () => clearTimeout(timer);
    }
  }, [open, cooldownMs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-70 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 flex flex-col gap-5 text-center">
        {danger && (
          <div className="mx-auto w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
        )}
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">{title}</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 whitespace-pre-line">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={locked}
            className={`flex-1 py-3 px-4 font-medium rounded-xl transition-colors ${
              danger ? "bg-red-500 hover:bg-red-600 text-white" : "bg-[#FBBF24] hover:bg-amber-500 text-neutral-900"
            } ${locked ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
