// Gemini transaction parser shared by the local Express server (server.ts)
// and the Cloudflare Pages Functions (functions/api/*). Uses the REST API via
// fetch so it runs unchanged on Node and on Cloudflare Workers.

export const SHARED_SYSTEM_INSTRUCTION = `Extract transaction data from voice/text (Indonesian, English, or mixed). Ignore filler words and background talk.

KATEGORI (always Indonesian, fixed list):
- Makan: meals (nasi, lunch, dinner, sarapan, padang, warteg, soto, mie)
- Jajan: snacks, drinks, coffee (kopi, ngopi, cemilan, gorengan, es, boba)
- Transport: ojek, gojek, grab, bensin, parkir, uber, taxi
- Belanja: groceries, shopping (indomaret, alfamart, supermarket, mall)
- Tagihan: bills (listrik, internet, pulsa, paket data, air, langganan)
- Lainnya: anything else (medical, entertainment, gift, etc.)

PLATFORM rules:
- Brand/store/place name (Starbucks, Warmindo, Gojek, Tokopedia).
- TRIGGER WORDS (HINT, NOT literal): "Restoran", "Restaurant", "Cafe", "Kafe", "Warung", "Waroeng", "Rumah Makan", "RM", "Depot", "Kedai", "Toko", "Minimarket", "Supermarket", "Mall", "Bakso", "Mie Ayam", "Sate". When user says one of these before a name, it signals "the next word IS a place name — try harder to match it to a known brand using phonetic matching." Strategy:
  1. FIRST: try to match what follows to a KNOWN BRAND (see list below). Phonetic mishearings are common — "salaria"→"Solaria", "kaku"→"Gyu-Kaku", "king burger"→"Burger King", "sabwey"→"Subway", "minimaret"→"Indomaret". If match found, output ONLY the brand (no trigger word prefix).
  2. ONLY IF no known brand matches AND the name sounds unfamiliar/local: output "<TriggerWord> <verbatim heard>" (e.g., "Warung Bu Sri", "Depot Jeng Tutie").
  3. NEVER output just the trigger word alone ("Restoran", "Minimarket", "Warung"). Always include something after it.

KNOWN BRANDS (memorize, match phonetically even if speech is unclear):
- Fast food: McDonald's / McD, KFC, Burger King, Subway, Pizza Hut, Domino's, A&W, Wendy's, HokBen / Hoka Hoka Bento, Yoshinoya, Sushi Tei, Sushi Hiro, Gyu-Kaku, Gokana, Genki Sushi, Marugame Udon, Ichiban Sushi, Ootoya, Richeese Factory, CFC, Texas Chicken
- Restaurant chains: Solaria, Pagi Sore, Sederhana, Padang Sederhana, Bakmi GM, Es Teler 77, D'Cost, Ayam Bakar Wong Solo, Waroeng Steak & Shake, Abuba Steak, Bebek Kaleyo, Bebek Tepi Sawah, Sari Ratu, Pepper Lunch, Hanamasa, Suki, Bakmi Naga
- Cafe chains: Starbucks, Janji Jiwa, Kopi Kenangan, Fore Coffee, Kopi Tuku, Excelso, Maxx Coffee, Coffee Bean, %Arabica, Anomali Coffee, Tanamera, Tomoro Coffee, Point Coffee, Flash Coffee
- Minimarkets: Indomaret, Alfamart, Lawson, Circle K, FamilyMart, Alfamidi, 7-Eleven
- Supermarkets: Hypermart, Transmart, Carrefour, Superindo, Hero, Ranch Market, Grand Lucky, Foodhall, Tip Top, Lotte Mart
- Transport: Gojek, Grab, Bluebird, Maxim, InDriver
- Marketplace: Tokopedia, Shopee, Bukalapak, Lazada, Blibli, Zalora, TikTok Shop

- For unfamiliar local places (no known brand match): write literally (e.g., "Oharang", "Mie Ayam Pak Kumis", "Bakso Mas Kribo", "Warung Bu Sri"). Do NOT leave empty.
- NEVER put payment app names here (GoPay/OVO/DANA go to payment_method).
- Empty string "" only if NO place/brand mentioned at all.

HARGA (output as IDR integer):
Standard:
- "ribu" / "rb" / "k" / "rebu" → ×1000 ("25 ribu" = 25000)
- "juta" / "jt" → ×1000000
- Text numbers: "lima ribu" = 5000, "dua puluh lima ribu" = 25000

Indonesian Hokkien slang (very common, must recognize):
- cepe / cepek = 100
- gocap = 50
- ceceng = 1000
- goceng = 5000
- ceban = 10000
- goban = 50000
- noban = 90000
- cepego = 100000
- gopego = 500000
- nopego = 900000
- cetiaw / cetiau = 1000000

PAYMENT_METHOD: Cash, QRIS, Transfer, GoPay, OVO, DANA, ShopeePay, Kartu, Paylater. Default "QRIS" if not mentioned.

CONFIDENCE — be LENIENT, fill what you can:
- "high": amount + category clear, and (detail OR platform) present.
- "medium": you can extract amount AND at least one of (category, detail, platform). FILL THE RESPONSE with what you heard — do NOT return zeros or empty just because some info is uncertain.
- "low": ONLY when no transaction info at all (greetings, random talk, no number AND no item mentioned).

CRITICAL: If you hear AT LEAST 2 of (amount, item/food/service, platform), fill all fields with best effort and return "medium" or "high". Never default to "low" if any meaningful transaction signal exists.

RAW_TRANSCRIPT (REQUIRED — used for debug):
- For voice: write verbatim what you HEARD, exactly as spoken (including filler "eh", "anu", repeats, even if unclear or wrong). Do NOT clean up.
- For text: write the input text as-is (no processing).
- This field is critical for low-confidence cases so the developer can see what was actually said vs what was parsed.

RULES:
- Single transaction per input. Multiple items → sum amounts, combine in detail.
- Non-sequential speech order is fine.
- Correct misheard words using domain knowledge (food, brands, places).

Examples:
1. "Beli kopi goceng di Oharang pakai QRIS"
   → { kategori: "Jajan", platform: "Oharang", harga: 5000, detail: "kopi", payment_method: "QRIS", confidence: "high", raw_transcript: "Beli kopi goceng di Oharang pakai QRIS" }

2. "Makan ceban di Depot Jeng Tutie"
   → { kategori: "Makan", platform: "Depot Jeng Tutie", harga: 10000, detail: "makan", payment_method: "QRIS", confidence: "high", raw_transcript: "Makan ceban di Depot Jeng Tutie" }

2b. "Ngopi di Cafe Nako goceng pakai gopay" (Nako = unknown local cafe, keep trigger word)
   → { kategori: "Jajan", platform: "Cafe Nako", harga: 5000, detail: "kopi", payment_method: "GoPay", confidence: "high", raw_transcript: "Ngopi di Cafe Nako goceng pakai gopay" }

2c. "Makan di Restoran Solaria 50rb" (Solaria = known brand → drop "Restoran")
   → { kategori: "Makan", platform: "Solaria", harga: 50000, detail: "makan", payment_method: "QRIS", confidence: "high", raw_transcript: "Makan di Restoran Solaria 50rb" }

2d. "Restoran Salaria 30rb" (mishearing of Solaria → match phonetically)
   → { kategori: "Makan", platform: "Solaria", harga: 30000, detail: "makan", payment_method: "QRIS", confidence: "high", raw_transcript: "Restoran Salaria 30rb" }

2e. "Restoran kaku 80rb pakai kartu" (mishearing of Gyu-Kaku → match phonetically, drop trigger word)
   → { kategori: "Makan", platform: "Gyu-Kaku", harga: 80000, detail: "makan", payment_method: "Kartu", confidence: "high", raw_transcript: "Restoran kaku 80rb pakai kartu" }

2f. "Beli di minimarket Lawson goceng" (Lawson = known minimarket → drop trigger word)
   → { kategori: "Belanja", platform: "Lawson", harga: 5000, detail: "belanja", payment_method: "QRIS", confidence: "high", raw_transcript: "Beli di minimarket Lawson goceng" }

3. "Nasi padang 25rb" (no platform, no payment mentioned)
   → { kategori: "Makan", platform: "", harga: 25000, detail: "nasi padang", payment_method: "QRIS", confidence: "medium", raw_transcript: "Nasi padang 25rb" }

4. "Bayar listrik cepego transfer"
   → { kategori: "Tagihan", platform: "", harga: 100000, detail: "listrik", payment_method: "Transfer", confidence: "high", raw_transcript: "Bayar listrik cepego transfer" }

5. "Lunch at Warmindo 30 thousand cash"
   → { kategori: "Makan", platform: "Warmindo", harga: 30000, detail: "lunch", payment_method: "Cash", confidence: "high", raw_transcript: "Lunch at Warmindo 30 thousand cash" }

6. "Halo apa kabar" (no transaction at all)
   → { kategori: "Lainnya", platform: "", harga: 0, detail: "", payment_method: "QRIS", confidence: "low", raw_transcript: "Halo apa kabar" }`;


export const SHARED_SCHEMA = {
  type: "OBJECT",
  properties: {
    kategori: { type: "STRING", description: "Makan, Jajan, Transport, Belanja, Tagihan, or Lainnya" },
    platform: { type: "STRING", description: "Store, brand, or location only — never payment apps (e.g., Warmindo, Starbucks, Gojek, Tokopedia)" },
    harga: { type: "NUMBER", description: "Numerical amount in IDR" },
    detail: { type: "STRING", description: "What was purchased in brief" },
    payment_method: { type: "STRING", description: "Cash, QRIS, Transfer, GoPay, OVO, DANA, ShopeePay, Kartu, or Paylater" },
    confidence: { type: "STRING", description: "high, medium, or low" },
    raw_transcript: { type: "STRING", description: "Verbatim transcription of the audio (everything you heard, including filler words) or the input text as-is. Used for debugging low-confidence cases." },
  },
  required: ["kategori", "platform", "harga", "detail", "payment_method", "confidence", "raw_transcript"],
};

export type GeminiPart = { text: string } | { inlineData: { data: string; mimeType: string } };

export const MODELS_TO_TRY = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

class GeminiHttpError extends Error {
  constructor(public httpStatus: number, public apiStatus: string, message: string) {
    super(message);
  }
}

async function callModel(apiKey: string, model: string, parts: GeminiPart[]): Promise<string> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        systemInstruction: { parts: [{ text: SHARED_SYSTEM_INSTRUCTION }] },
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: SHARED_SCHEMA,
        },
      }),
    }
  );

  const data: any = await resp.json().catch(() => null);
  if (!resp.ok) {
    const message = data?.error?.message || `HTTP ${resp.status}`;
    throw new GeminiHttpError(resp.status, data?.error?.status || "", `${resp.status} ${message}`);
  }

  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => p.text ?? "")
    .join("");
  if (!text) {
    const reason = data?.promptFeedback?.blockReason;
    throw new GeminiHttpError(400, "", reason ? `Blocked by policy: ${reason}` : "Empty response from model");
  }
  return text;
}

export async function generateTransactionContent(apiKey: string, parts: GeminiPart[]): Promise<string> {
  for (let i = 0; i < MODELS_TO_TRY.length; i++) {
    const model = MODELS_TO_TRY[i];

    try {
      return await callModel(apiKey, model, parts);
    } catch (err: any) {
      console.warn(`Error with model ${model}:`, err.message || err);

      const errorMessage = typeof err.message === "string" ? err.message : JSON.stringify(err);

      const isServerError =
        err.apiStatus === "UNAVAILABLE" ||
        err.httpStatus === 503 ||
        err.apiStatus === "INTERNAL" ||
        err.httpStatus === 500 ||
        err.apiStatus === "RESOURCE_EXHAUSTED" ||
        err.httpStatus === 429 ||
        errorMessage.toLowerCase().includes("quota") ||
        errorMessage.toLowerCase().includes("too many requests");

      if (isServerError && i < MODELS_TO_TRY.length - 1) {
        console.log(`Model ${model} unavailable (server error/limit). Retrying with next model...`);
        continue;
      }

      let cleanError = errorMessage;
      if (errorMessage.toLowerCase().includes("policy")) {
        cleanError = "Input diblokir oleh sistem keamanan, teks tidak bisa diproses karena melanggar policy.";
      } else if (err.httpStatus === 401 || err.httpStatus === 403 || errorMessage.toLowerCase().includes("api key")) {
        cleanError = "Akses Ditolak: API Key tidak valid atau tidak memiliki akses (Unauthorized).";
      } else if (err.httpStatus === 404) {
        cleanError = "Model tidak ditemukan (404).";
      } else if (err.httpStatus === 400) {
        cleanError = "Bad Request: Permintaan tidak valid. Detail: " + errorMessage;
      }
      throw new Error(cleanError);
    }
  }
  throw new Error("No model available");
}

// Builds the Gemini parts for the two API routes, so both runtimes stay identical.
export function audioParts(audioBase64: string, mimeType?: string): GeminiPart[] {
  return [
    { inlineData: { data: audioBase64, mimeType: mimeType || "audio/webm" } },
    { text: "Extract transaction data from this Indonesian, English, or mixed voice input." },
  ];
}

export function textParts(textInput: string): GeminiPart[] {
  return [
    { text: textInput },
    { text: "Extract transaction data from this Indonesian, English, or mixed text input." },
  ];
}
