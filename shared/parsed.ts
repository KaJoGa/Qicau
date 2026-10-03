// Runtime validation of the transaction JSON returned by Gemini. Used by both API
// runtimes (server.ts, worker.ts) and again by the client before saving, so the
// stated limits hold even though the model output is otherwise trusted as-is.

export const MAX_HARGA = 999_999_999;
export const MAX_PLATFORM = 50;
export const MAX_DETAIL = 200;
export const MAX_RAW_TRANSCRIPT = 1000;

const CATEGORIES = ["Makan", "Jajan", "Transport", "Belanja", "Tagihan", "Lainnya"];
const PAYMENT_METHODS = ["Cash", "QRIS", "Transfer", "GoPay", "OVO", "DANA", "ShopeePay", "Kartu", "Paylater"];
const CONFIDENCES = ["high", "medium", "low"];

export interface SanitizedTransaction {
  kategori: string;
  platform: string;
  harga: number;
  detail: string;
  payment_method: string;
  confidence: "high" | "medium" | "low";
  raw_transcript: string;
}

function pickFromList(value: unknown, list: string[], fallback: string): string {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return list.find((item) => item.toLowerCase() === text) ?? fallback;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Throws an Error with a user-facing Indonesian message when the result can't be trusted.
// `textInput` (text route only) overrides raw_transcript so it is always the exact input.
export function sanitizeParsed(input: unknown, textInput?: string): SanitizedTransaction {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Respons AI tidak valid, silakan coba lagi.");
  }
  const raw = input as Record<string, unknown>;

  let harga = Number(raw.harga);
  if (!Number.isFinite(harga) || harga < 0) harga = 0;
  harga = Math.round(harga);
  if (harga > MAX_HARGA) {
    throw new Error("Jumlah yang terdeteksi melebihi batas Rp 999.999.999. Periksa kembali atau catat lewat Formulir Langsung.");
  }

  return {
    kategori: pickFromList(raw.kategori, CATEGORIES, "Lainnya"),
    platform: cleanText(raw.platform, MAX_PLATFORM),
    harga,
    detail: cleanText(raw.detail, MAX_DETAIL),
    payment_method: pickFromList(raw.payment_method, PAYMENT_METHODS, "QRIS"),
    confidence: pickFromList(raw.confidence, CONFIDENCES, "medium") as SanitizedTransaction["confidence"],
    raw_transcript: textInput !== undefined
      ? textInput.slice(0, MAX_RAW_TRANSCRIPT)
      : cleanText(raw.raw_transcript, MAX_RAW_TRANSCRIPT),
  };
}

// Takes Gemini's JSON text (possibly fenced) and returns the sanitized JSON text.
export function normalizeParsedResult(resultText: string, textInput?: string): string {
  const stripped = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error("Respons AI tidak valid, silakan coba lagi.");
  }
  return JSON.stringify(sanitizeParsed(parsed, textInput));
}
