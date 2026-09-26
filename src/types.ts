export type Transaction = {
  id: string;
  user_id: string;
  kategori: string;
  platform: string;
  harga: number;
  detail: string;
  payment_method: string;
  confidence: "high" | "medium" | "low";
  raw_transcript?: string;
  created_at: number; // Unix timestamp
  is_exported?: boolean;
};

export type ParsedTransaction = Omit<Transaction, "id" | "user_id" | "created_at">;
