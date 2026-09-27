import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { collection, query, where, documentId, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { dayIdFromTimestamp } from "../lib/dailySummary";
import { getCategoryIcon } from "./HomeView";
import { dict } from "../lib/i18n";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowLeftRight } from "lucide-react";

const COLORS: Record<string, string> = {
  "Makan": "#ef4444",      // red-500
  "Jajan": "#f97316",      // orange-500
  "Transport": "#3b82f6",  // blue-500
  "Belanja": "#a855f7",    // purple-500
  "Tagihan": "#eab308",    // yellow-500
  "Lainnya": "#8b5cf6",    // violet-500
};

export function MonthlyView({ user, t }: { user: User; t: typeof dict["id"] }) {
  const [filterMode, setFilterMode] = useState<"monthly" | "weekly">("monthly");
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [catTotals, setCatTotals] = useState<Record<string, number>>({});
  
  useEffect(() => {
    const start = new Date();
    if (filterMode === "monthly") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else {
      // Weekly: start on Monday of current week
      const day = start.getDay();
      const diff = (day + 6) % 7; // 0 if Mon, 6 if Sun
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
    }

    // daily_summaries doc ids are `${uid}_${YYYYMMDD}`, so a plain documentId()
    // range query stays scoped to this user's days without needing a composite index.
    const startId = `${user.uid}_${dayIdFromTimestamp(start.getTime())}`;
    const endId = `${user.uid}_${dayIdFromTimestamp(Date.now())}`;

    const q = query(
      collection(db, "daily_summaries"),
      where(documentId(), ">=", startId),
      where(documentId(), "<=", endId)
    );

    const unsub = onSnapshot(q, (snap) => {
      let tot = 0;
      const cats: Record<string, number> = {};

      snap.docs.forEach(d => {
        const summary = d.data() as { total: number; by_category?: Record<string, number> };
        tot += summary.total || 0;
        Object.entries(summary.by_category || {}).forEach(([kategori, amount]) => {
          cats[kategori] = (cats[kategori] || 0) + amount;
        });
      });

      setTotalExpenses(tot);
      setCatTotals(cats);
    });

    return unsub;
  }, [user.uid, filterMode]);

  const formatIdr = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
  };

  const now = new Date();
  const currentMonthLabel = `${t.monthLabels[now.getMonth() as keyof typeof t.monthLabels]} ${now.getFullYear()}`;

  const sortedCats = Object.entries(catTotals).sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
  
  const pieData = sortedCats.map(([name, value]) => ({
    name: t.categories[name as keyof typeof t.categories] || name,
    originalName: name,
    value,
  }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-baseline gap-2 flex-wrap">
          <span>{filterMode === "monthly" ? t.thisMonthSummary : "Ringkasan Minggu Ini"}</span>
          {filterMode === "monthly" && (
            <span className="text-sm font-normal text-neutral-400 dark:text-neutral-500">{currentMonthLabel}</span>
          )}
        </h2>
        <button
          onClick={() => setFilterMode(filterMode === "monthly" ? "weekly" : "monthly")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors border border-neutral-200 dark:border-neutral-700 active:scale-95 shrink-0"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500 dark:text-[#FBBF24]" />
          <span>{filterMode === "monthly" ? "Mingguan" : "Bulanan"}</span>
        </button>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-none shadow-sm dark:shadow-none rounded-3xl p-6 mb-8 text-center flex flex-col items-center justify-center">
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-2">{t.totalExpenses}</p>
        <h3 className="text-4xl font-bold text-neutral-900 dark:text-white tracking-tight w-full break-all">{formatIdr(totalExpenses)}</h3>
      </div>

      {sortedCats.length > 0 && (
        <div className="h-64 mb-8">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.originalName] || "#FBBF24"} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatIdr(value)}
                contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-4 uppercase tracking-widest">{t.category}</h3>
        {sortedCats.length === 0 ? (
          <p className="text-neutral-600 dark:text-neutral-400 text-sm">{filterMode === "monthly" ? t.noHistory : "Belum ada riwayat transaksi minggu ini."}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {sortedCats.map(([cat, amount]: [string, number]) => {
              const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
              return (
                <div key={cat} className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-none shadow-sm dark:shadow-none p-4 rounded-2xl">
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                       <span className="text-xl">{getCategoryIcon(cat)}</span>
                       <span className="font-semibold text-neutral-900 dark:text-white">{t.categories[cat as keyof typeof t.categories] || cat}</span>
                    </div>
                    <span className="font-mono text-neutral-900 dark:text-white text-sm break-all text-right">{formatIdr(amount)}</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-[#FBBF24] h-full rounded-full" 
                      style={{ width: `${pct}%`, backgroundColor: COLORS[cat] || "#FBBF24" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
