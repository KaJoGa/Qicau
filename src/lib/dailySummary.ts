// Per-day aggregate of transactions, kept in sync with the `transactions` collection
// on every create/edit/delete. MonthlyView reads these instead of scanning every
// transaction, so its cost stays bounded to (days in range) instead of (total transactions).
//
// Consistency: every transaction write and its summary delta go into ONE write batch
// (all-or-nothing, also while offline), so they can't drift apart. As a safety net,
// MonthlyView repairs any single day whose summary is internally inconsistent.
import { doc, setDoc, getDocsFromServer, collection, query, where, orderBy, increment, DocumentData, WriteBatch } from "firebase/firestore";
import { db } from "./firebase";
import { Transaction } from "../types";

export function dayIdFromTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function summaryDocRef(uid: string, dayId: string) {
  return doc(db, "daily_summaries", `${uid}_${dayId}`);
}

// Adds a signed delta for the day `createdAt` falls on to `batch`.
// sign=1 for a transaction being added, sign=-1 for one being removed/reversed.
export function addSummaryDelta(batch: WriteBatch, uid: string, createdAt: number, kategori: string, harga: number, sign: 1 | -1) {
  const dayId = dayIdFromTimestamp(createdAt);
  const delta = sign * harga;
  // Nested object, not a dotted "by_category.X" key: set() treats dots in a key as
  // part of a literal field name (only update() splits paths), which silently
  // created a stray top-level field the Ringkasan view never reads.
  batch.set(summaryDocRef(uid, dayId), {
    user_id: uid,
    day: dayId,
    total: increment(delta),
    by_category: { [kategori]: increment(delta) },
  }, { merge: true });
}

// True when a day's summary contradicts itself: the category breakdown doesn't add up
// to the total, or it carries stray dotted fields from an older buggy write.
export function summaryNeedsRepair(data: DocumentData): boolean {
  const total = Number(data.total) || 0;
  const cats = data.by_category && typeof data.by_category === "object" ? Object.values(data.by_category) : [];
  const sum = cats.reduce((acc: number, v) => acc + (Number(v) || 0), 0);
  const hasStrayField = Object.keys(data).some((k) => k.startsWith("by_category."));
  return hasStrayField || sum !== total;
}

// Recomputes ONE day's summary from its transactions (reads only that day's
// transactions) and overwrites the summary doc. Needs the server, since a partial
// offline cache would produce wrong totals.
export async function rebuildDaySummary(uid: string, dayId: string): Promise<void> {
  const y = Number(dayId.slice(0, 4));
  const m = Number(dayId.slice(4, 6));
  const d = Number(dayId.slice(6, 8));
  const start = new Date(y, m - 1, d).getTime();
  const end = new Date(y, m - 1, d + 1).getTime() - 1;

  const snap = await getDocsFromServer(query(
    collection(db, "transactions"),
    where("user_id", "==", uid),
    where("created_at", ">=", start),
    where("created_at", "<=", end),
    orderBy("created_at", "desc")
  ));

  let total = 0;
  const byCategory: Record<string, number> = {};
  snap.docs.forEach((docSnap) => {
    const tx = docSnap.data() as Transaction;
    const harga = tx.harga || 0;
    total += harga;
    byCategory[tx.kategori] = (byCategory[tx.kategori] || 0) + harga;
  });

  // No delete rule on this collection: an empty day is overwritten with zeros.
  await setDoc(summaryDocRef(uid, dayId), { user_id: uid, day: dayId, total, by_category: byCategory });
}
