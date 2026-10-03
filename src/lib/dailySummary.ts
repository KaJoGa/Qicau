// Per-day aggregate of transactions, kept in sync with the `transactions` collection
// on every create/edit/delete. MonthlyView reads these instead of scanning every
// transaction, so its cost stays bounded to (days in range) instead of (total transactions).
import { doc, setDoc, getDocs, collection, query, where, increment } from "firebase/firestore";
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

export function summaryRangeIds(uid: string, start: Date, end: Date): { startId: string; endId: string } {
  return {
    startId: `${uid}_${dayIdFromTimestamp(start.getTime())}`,
    endId: `${uid}_${dayIdFromTimestamp(end.getTime())}`,
  };
}

// Applies a signed delta to the daily summary for the day `createdAt` falls on.
// sign=1 for a transaction being added, sign=-1 for one being removed/reversed.
export function bumpDailySummary(uid: string, createdAt: number, kategori: string, harga: number, sign: 1 | -1) {
  const dayId = dayIdFromTimestamp(createdAt);
  const delta = sign * harga;
  // Nested object, not a dotted "by_category.X" key: setDoc() treats dots in a key as
  // part of a literal field name (only updateDoc() splits paths), which silently
  // created a stray top-level field the Ringkasan view never reads.
  setDoc(summaryDocRef(uid, dayId), {
    user_id: uid,
    day: dayId,
    total: increment(delta),
    by_category: { [kategori]: increment(delta) },
  }, { merge: true }).catch((e) => {
    console.error("daily_summaries write err", e);
  });
}

// One-off, idempotent recompute of every daily summary from the source-of-truth
// `transactions` collection. Safe to re-run any time (e.g. if summaries ever drift).
export async function rebuildAllDailySummaries(uid: string): Promise<number> {
  const snap = await getDocs(query(collection(db, "transactions"), where("user_id", "==", uid)));
  const byDay = new Map<string, { total: number; by_category: Record<string, number> }>();

  snap.docs.forEach((d) => {
    const tx = d.data() as Transaction;
    const dayId = dayIdFromTimestamp(tx.created_at);
    const entry = byDay.get(dayId) || { total: 0, by_category: {} };
    entry.total += tx.harga || 0;
    entry.by_category[tx.kategori] = (entry.by_category[tx.kategori] || 0) + (tx.harga || 0);
    byDay.set(dayId, entry);
  });

  for (const [dayId, entry] of byDay.entries()) {
    await setDoc(summaryDocRef(uid, dayId), {
      user_id: uid,
      day: dayId,
      total: entry.total,
      by_category: entry.by_category,
    });
  }

  // Days that used to have transactions but now have none (all deleted) won't
  // appear in byDay above, so their old summary doc would otherwise be left
  // stale forever. Zero them out explicitly (there's no delete rule for this
  // collection - summaries are only ever created/overwritten, never deleted).
  const existingSummaries = await getDocs(query(collection(db, "daily_summaries"), where("user_id", "==", uid)));
  for (const d of existingSummaries.docs) {
    const dayId = d.data().day as string;
    if (!byDay.has(dayId)) {
      await setDoc(d.ref, { user_id: uid, day: dayId, total: 0, by_category: {} });
    }
  }

  return byDay.size;
}
