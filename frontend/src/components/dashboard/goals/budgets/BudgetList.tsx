"use client";

import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Plus,
  Target,
  Pencil,
  Trash2,
  CalendarDays,
  Filter,
  ChevronDown,
} from "lucide-react";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { normalizeCategory, getCategoryLabel } from "@/lib/categories";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLang } from "@/contexts/LangContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { es as esLocale } from "date-fns/locale";
import { useState } from "react";
import { useExclusiveDropdown } from "@/hooks/useExclusiveDropdown";

// Design tokens
const P = {
  lime: "var(--color-income)",
  red: "var(--color-expense)",
  amber: "var(--color-savings)",
  purple: "var(--color-investment)",
  textPri: "var(--foreground)",
  textSec: "var(--muted-foreground)",
  textDim: "var(--muted-foreground)",
  border: "var(--glass-border)",
};

export interface Budget {
  id: string;
  user_id: string;
  short_id?: number;
  name: string;
  type: string;
  amount: number;
  amount_usd?: number;
  rate_at_entry?: number;
  currency?: string;
  categories: string[];
  date_from: string | null;
  date_to: string | null;
  recurrence?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  amount: number;
  amount_usd?: number;
  date: string;
  type: string;
  category: string;
}

export function getBudgetCycle(
  budget: Budget,
  referenceDate: Date = new Date()
): { from: Date | null; to: Date | null; label: string } {
  if (!budget.recurrence) {
    return {
      from: budget.date_from ? new Date(budget.date_from) : null,
      to: budget.date_to ? new Date(budget.date_to) : null,
      label: "",
    };
  }

  const d = new Date(referenceDate);
  let from: Date, to: Date, label: string;

  switch (budget.recurrence) {
    case "daily":
      from = new Date(d.setHours(0, 0, 0, 0));
      to = new Date(d.setHours(23, 59, 59, 999));
      label = format(d, "MMM d");
      break;
    case "weekly": {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      from = new Date(new Date(d).setDate(diff));
      from.setHours(0, 0, 0, 0);
      to = new Date(new Date(from).setDate(from.getDate() + 6));
      to.setHours(23, 59, 59, 999);
      label = `W${format(d, "w, MMM")}`;
      break;
    }
    case "yearly":
      from = new Date(d.getFullYear(), 0, 1);
      to = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
      label = format(d, "yyyy");
      break;
    case "monthly":
    default:
      from = new Date(d.getFullYear(), d.getMonth(), 1);
      to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      label = format(d, "MMMM yyyy");
      break;
  }

  return { from, to, label };
}

export function getBudgetSpent(
  budget: Budget,
  txs: Transaction[],
  referenceDate: Date = new Date()
): number {
  const { from, to } = getBudgetCycle(budget, referenceDate);

  // Enforce budget.date_from as minimum boundary (never count before budget creation)
  const minDate = budget.date_from ? new Date(budget.date_from) : null;

  return txs
    .filter((tx) => {
      if (tx.type !== "expense") return false;
      if (!tx.date) return false;
      const txDate = new Date(tx.date);

      // Respect cycle boundaries
      if (from && txDate < from) return false;
      if (to && txDate > to) return false;

      // Respect budget creation date (never count before budget was created)
      if (minDate && txDate < minDate) return false;

      return (
        budget.categories.length === 0 ||
        budget.categories.some(
          (c) => normalizeCategory(c) === normalizeCategory(tx.category)
        )
      );
    })
    .reduce((s, tx) => s + Number(tx.amount_usd ?? tx.amount), 0);
}

interface BudgetListProps {
  budgets: Budget[];
  transactions: Transaction[];
  loading: boolean;
  onEdit: (b: Budget) => void;
  onDelete: (b: Budget) => void;
  onCreateNew: () => void;
}

export default function BudgetList({
  budgets,
  transactions,
  loading,
  onEdit,
  onDelete,
  onCreateNew,
}: BudgetListProps) {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const { fmt } = useCurrency();
  const { openId, setOpen } = useExclusiveDropdown();

  const [budgetHistMonth, setBudgetHistMonth] = useState<string>("all");
  const [budgetHistYear, setBudgetHistYear] = useState<string>(new Date().getFullYear().toString());
  const [historyPage, setHistoryPage] = useState(0);

  // Helper to capitalize first letter (for month names in Spanish)
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div
          className="h-6 w-6 rounded-full border-t-2 border-r-2"
          style={{ borderColor: P.lime, animation: "spin 1s linear infinite" }}
        />
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center gap-4 py-16 rounded-2xl"
        style={{ border: `1px dashed ${P.border}` }}
      >
        <Target className="w-10 h-10 opacity-30" style={{ color: P.lime }} />
        <p className="text-[13px]" style={{ color: P.textDim }}>
          {t("No budgets yet. Create your first one!", "No hay presupuestos")}
        </p>
        <Button
          onClick={onCreateNew}
          size="sm"
          className="mt-1 btn-primary"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {t("Create Budget", "Crear Presupuesto")}
        </Button>
      </motion.div>
    );
  }

  // Build history data
  const today = new Date();
  const fixedExpired = budgets.filter(
    (b) => !b.recurrence && b.date_to && new Date(b.date_to) < today
  ).map((b) => {
    const { from, to, label } = getBudgetCycle(b);
    return { budget: b, from, to, label, spent: getBudgetSpent(b, transactions) };
  });

  const recurringPast: { budget: Budget; from: Date | null; to: Date | null; label: string; spent: number }[] = [];
  budgets.forEach((b) => {
    if (!b.recurrence) return;
    [1, 2, 3].forEach((offset) => {
      const pastDate = new Date();
      if (b.recurrence === "daily") pastDate.setDate(pastDate.getDate() - offset);
      if (b.recurrence === "weekly") pastDate.setDate(pastDate.getDate() - offset * 7);
      if (b.recurrence === "monthly") pastDate.setMonth(pastDate.getMonth() - offset);
      if (b.recurrence === "yearly") pastDate.setFullYear(pastDate.getFullYear() - offset);

      const { from, to, label } = getBudgetCycle(b, pastDate);
      const startPoint = b.date_from ? new Date(b.date_from) : new Date(b.created_at);
      const startPointNormalized = new Date(startPoint.getFullYear(), startPoint.getMonth(), startPoint.getDate());

      if (from && from >= startPointNormalized) {
        const spent = getBudgetSpent(b, transactions, pastDate);
        recurringPast.push({ budget: b, from, to, label, spent });
      }
    });
  });

  const allHistory = [...fixedExpired, ...recurringPast].sort(
    (a, b) => (b.to?.getTime() || 0) - (a.to?.getTime() || 0)
  );

  return (
    <>
      {/* Budget cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AnimatePresence>
          {budgets.map((b, i) => {
            const spent = getBudgetSpent(b, transactions);
            const budgetLimit = b.amount_usd ?? b.amount;
            const pct = budgetLimit > 0 ? Math.min(100, (spent / budgetLimit) * 100) : 0;
            const { from, to } = getBudgetCycle(b);
            const isOver = spent > budgetLimit;
            const progressColor = isOver ? P.amber : pct > 75 ? P.amber : P.lime;

            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
              >
                <Card
                  className="glass-card"
                  style={{
                    borderColor: isOver
                      ? "rgba(255,170,51,0.4)"
                      : pct > 75
                        ? "rgba(255,170,51,0.25)"
                        : "var(--glass-border)",
                  }}
                >
                  <CardHeader className="pb-2 px-4 pt-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="type-title truncate">
                          {b.name}
                        </CardTitle>
                        <p className="text-[10px] mt-0.5" style={{ color: P.textDim }}>
                          {from ? format(from, "MMM d") : "—"}
                          {" – "}
                          {to ? format(to, "MMM d, yyyy") : "—"}
                          {b.short_id && ` - id #${b.short_id}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => onEdit(b)}
                          className="btn-icon-sm hover:bg-white/10"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => onDelete(b)}
                          className="btn-icon-sm hover:bg-[rgba(255,170,51,0.1)]"
                        >
                          <Trash2 className="w-3.5 h-3.5" style={{ color: P.amber }} />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 space-y-2.5">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px]" style={{ color: P.textSec }}>
                          {fmt(spent)} / {fmt(budgetLimit)}
                        </span>
                        <span
                          className="text-[11px] font-bold"
                          style={{ color: progressColor }}
                        >
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div
                        className="w-full h-2 rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.08)" }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          style={{
                            background: isOver
                              ? `linear-gradient(90deg, var(--color-savings) 0%, #CC6600 100%)`
                              : pct > 80
                                ? `linear-gradient(90deg, var(--color-income) 0%, var(--color-savings) 100%)`
                                : `linear-gradient(90deg, #8BC34A, var(--color-income))`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Labels row: categories (left) and period (right) */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1 min-w-0">
                        {b.categories.slice(0, 3).map((cat) => {
                          const Icon = getCategoryIcon(cat);
                          const label = getCategoryLabel(cat, lang);
                          return (
                            <span
                              key={cat}
                              className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 font-medium"
                              style={{
                                background: "rgba(179,136,255,0.08)",
                                border: "1px solid rgba(179,136,255,0.2)",
                                borderRadius: "6px",
                                color: "#B388FF",
                              }}
                            >
                              <Icon className="w-3 h-3" />
                              {label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()}
                            </span>
                          );
                        })}
                      </div>
                      {b.recurrence && (
                        <span
                          className="badge-period shrink-0"
                          style={{
                            fontSize: "9px",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: "rgba(179,136,255,0.08)",
                            border: "1px solid rgba(179,136,255,0.25)",
                            color: "#B388FF",
                          }}
                        >
                          {t(
                            b.recurrence.charAt(0).toUpperCase() + b.recurrence.slice(1),
                            b.recurrence === "daily" ? "Diario" :
                              b.recurrence === "weekly" ? "Semanal" :
                                b.recurrence === "monthly" ? "Mensual" :
                                  b.recurrence === "yearly" ? "Anual" : b.recurrence.charAt(0).toUpperCase() + b.recurrence.slice(1)
                          )}
                        </span>
                      )}
                    </div>


                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Budget History */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-white/5" />
          <h4 className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: P.textDim }}>
            {t("History", "Historial")}
          </h4>
          <div className="h-px flex-1 bg-white/5" />
        </div>

        {/* History Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <DropdownMenu open={openId === "budgetMonthFilter"} onOpenChange={(isOpen) => setOpen(isOpen ? "budgetMonthFilter" : null)}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2.5 bg-card/30 border-border text-[#a1a1aa] hover:bg-white/5 text-[12px]">
                <CalendarDays className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                {budgetHistMonth === "all"
                  ? t("Month", "Mes")
                  : capitalize(format(new Date(2000, parseInt(budgetHistMonth), 1), "MMMM", { locale: lang === "es" ? esLocale : undefined }))}
                <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-background border-border text-[#F0F5F1] max-h-[200px] overflow-y-auto">
              <DropdownMenuItem onClick={() => { setBudgetHistMonth("all"); setHistoryPage(0); }} className="dropdown-item-focus text-[12px] py-1.5">
                {t("All", "Todos")}
              </DropdownMenuItem>
              {Array.from({ length: 12 }).map((_, i) => (
                <DropdownMenuItem key={i} onClick={() => { setBudgetHistMonth(String(i)); setHistoryPage(0); }} className="dropdown-item-focus text-[12px] py-1.5">
                  {capitalize(format(new Date(2000, i, 1), "MMMM", { locale: lang === "es" ? esLocale : undefined }))}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu open={openId === "budgetYearFilter"} onOpenChange={(isOpen) => setOpen(isOpen ? "budgetYearFilter" : null)}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2.5 bg-card/30 border-border text-[#a1a1aa] hover:bg-white/5 text-[12px]">
                <Filter className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                {budgetHistYear}
                <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-background border-border text-[#F0F5F1]">
              {[
                ...new Set([
                  new Date().getFullYear(),
                  ...(allHistory.map((h) => h.to?.getFullYear()).filter(Boolean) as number[]),
                ]),
              ]
                .sort((a, b) => b - a)
                .map((y) => (
                  <DropdownMenuItem
                    key={y}
                    onClick={() => { setBudgetHistYear(y.toString()); setHistoryPage(0); }}
                    className="dropdown-item-focus text-[12px] py-1.5"
                  >
                    {y}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

        </div>

        {(() => {
          const filtered = allHistory.filter((h) => {
            if (budgetHistMonth !== "all" && h.to?.getMonth() !== parseInt(budgetHistMonth)) return false;
            if (h.to?.getFullYear() !== parseInt(budgetHistYear)) return false;
            return true;
          });
          const totalPages = Math.ceil(filtered.length / 10);
          const pageItems = filtered.slice(historyPage * 10, (historyPage + 1) * 10);

          if (filtered.length === 0) {
            return (
              <div
                className="flex items-center justify-center py-8 rounded-2xl text-[12px]"
                style={{ border: `1px dashed ${P.border}`, color: P.textDim }}
              >
                {t("No history matches filters", "Sin historial que coincida")}
              </div>
            );
          }

          return (
            <div className="space-y-2">
              {pageItems.map((item, idx) => {
                const b = item.budget;
                const spent = item.spent;
                const budgetLimit = b.amount_usd ?? b.amount;
                const isOver = spent > budgetLimit;
                const pct = budgetLimit > 0 ? (spent / budgetLimit) * 100 : 0;

                return (
                  <div
                    key={`${b.id}-${idx}`}
                    className="flex items-center justify-between px-4 py-3 rounded-xl group hover:bg-white/[0.04] transition-colors"
                    style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}` }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-semibold truncate" style={{ color: P.textPri }}>
                          {b.name}
                          {b.short_id && ` - id #${b.short_id}`}
                        </p>
                        {item.label && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 font-bold" style={{ color: P.textDim }}>
                            {item.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: P.textDim }}>
                        {item.from ? format(item.from, "MMM d") : "—"}{" – "}{item.to ? format(item.to, "MMM d, yyyy") : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <div className="text-right">
                        <p className="text-[12px] font-bold" style={{ color: isOver ? P.amber : P.lime }}>
                          {fmt(spent)} / {fmt(budgetLimit)}
                        </p>
                        <p className="text-[10px] opacity-60" style={{ color: isOver ? P.amber : P.lime }}>
                          {pct.toFixed(0)}%
                        </p>
                      </div>
                      <div className="w-1.5 h-6 rounded-full shrink-0" style={{ background: isOver ? P.amber : P.lime, opacity: 0.3 }} />
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 pt-2">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                    disabled={historyPage === 0}
                    className="text-[11px] px-2 py-1 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10 transition-colors"
                  >
                    {t("Prev", "Ant.")}
                  </button>
                  <span className="text-[11px]" style={{ color: P.textDim }}>
                    {historyPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setHistoryPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={historyPage >= totalPages - 1}
                    className="text-[11px] px-2 py-1 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10 transition-colors"
                  >
                    {t("Next", "Sig.")}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>

    </>
  );
}
