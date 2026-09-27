import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; icon?: string }[];
  placeholder?: string;
  required?: boolean;
}

export function SearchableSelect({
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
