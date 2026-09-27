import type { FormEvent } from "react";
import { X } from "lucide-react";
import { ParsedTransaction } from "../types";
import { SearchableSelect } from "./SearchableSelect";
import { CATEGORY_OPTIONS, PAYMENT_OPTIONS } from "../lib/txOptions";
import { dict } from "../lib/i18n";

export interface EditingTx {
  id: string;
  tx: ParsedTransaction;
  original: ParsedTransaction;
  createdAt: number;
}

interface EditTransactionModalProps {
  editingTx: EditingTx | null;
  onChange: (tx: ParsedTransaction) => void;
  onSave: (e: FormEvent) => void;
  onClose: () => void;
  t: typeof dict["id"];
}

// Shared by HomeView (post-save toast edit) and HistoryView (edit any past transaction).
export function EditTransactionModal({ editingTx, onChange, onSave, onClose, t }: EditTransactionModalProps) {
  if (!editingTx) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start pt-16 sm:items-center sm:pt-0 justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 leading-none overflow-y-auto max-h-[85vh]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{t.editTx}</h3>
          <button
            onClick={onClose}
            className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white p-2 -mr-2 bg-neutral-100 dark:bg-neutral-800/50 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="flex flex-col gap-4 pb-6">
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
              onChange={(e) => onChange({ ...editingTx.tx, platform: e.target.value })}
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
              onChange={(val) => onChange({ ...editingTx.tx, kategori: val })}
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
                    onChange({ ...editingTx.tx, harga: 0 });
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
                  onChange({ ...editingTx.tx, harga: num });
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
              onChange={(val) => onChange({ ...editingTx.tx, payment_method: val })}
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
              onChange={(e) => onChange({ ...editingTx.tx, detail: e.target.value })}
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
  );
}
