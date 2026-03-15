"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { getCategoryLabel } from "@/lib/categories";
import { Session } from "@supabase/supabase-js";
import { useCurrency } from "@/contexts/CurrencyContext";
import { SEMANTIC_COLORS } from "@/lib/colors";
import { useLang } from "@/contexts/LangContext";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BalanceKPIs from "./balance/BalanceKPIs";
import TransactionTable, {
  CategoryIconTick,
  type Transaction,
  type EditForm,
  type AddForm,
} from "./balance/TransactionTable";
import { getDefaultDate } from "@/lib/date";

const TRANSFER_CATEGORIES = ["investment_transfer", "savings_contribution", "savings_withdrawal", "investment_return"];

/**
 * Get the default selected month (current month in YYYY-MM format).
 * This allows users to see the chart for the current month by default.
 */
function getDefaultMonth(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Generate list of last 12 months in YYYY-MM format.
 */
function getMonthOptions(): Array<{ value: string; label: string }> {
  const today = new Date();
  const months: Array<{ value: string; label: string }> = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const value = `${year}-${month}`;
    const label = date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
    months.push({ value, label });
  }
  return months;
}

interface BalanceTabProps {
  transactions: Transaction[];
  loading: boolean;
  session: Session | null;
  onDelete: (tx: Transaction) => void;
  onEdit: (tx: Transaction) => void;
  onSaveEdit: (tx: Transaction, form: EditForm) => Promise<void>;
  onExportCSV: () => void;
  onRefresh: () => void;
}

export default function BalanceTab({
  transactions,
  loading,
  session,
  onDelete,
  onSaveEdit,
  onExportCSV,
  onRefresh,
}: BalanceTabProps) {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const { fmt, currency } = useCurrency();

  // ── Chart state ──────────────────────────────────────────────────────
  const [chartType, setChartType] = useState<"income" | "expense">("expense");
  const [selectedMonth, setSelectedMonth] = useState<string>(getDefaultMonth());

  // ── Add dialog state (open/form managed here, actual save handled by TransactionTable) ──
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    amount: "",
    description: "",
    category: "other",
    type: "expense",
    date: getDefaultDate(),
    currency: (currency as "USD" | "EUR" | "GBP") || "USD",
  });

  const openAddDialog = () => {
    setAddForm({ amount: "", description: "", category: "other", type: "expense", date: getDefaultDate(), currency: (currency as "USD" | "EUR" | "GBP") || "USD" });
    setAddDialogOpen(true);
  };

  // ── KPI computations ─────────────────────────────────────────────────
  const currentMonthIncome = useMemo(() => {
    const n = new Date();
    const currMonth = n.getMonth();
    const currYear = n.getFullYear();

    return transactions
      .filter((tx) => {
        if (tx.type !== "income") return false;
        const dateStr = tx.date ? tx.date.replace(" ", "T") : "";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return d.getMonth() === currMonth && d.getFullYear() === currYear;
      })
      .reduce((s, tx) => s + Number(tx.amount_usd ?? tx.amount ?? 0), 0);
  }, [transactions]);

  const currentMonthExpenses = useMemo(() => {
    const n = new Date();
    const currMonth = n.getMonth();
    const currYear = n.getFullYear();

    return transactions
      .filter((tx) => {
        if (tx.type !== "expense") return false;
        const dateStr = tx.date ? tx.date.replace(" ", "T") : "";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return d.getMonth() === currMonth && d.getFullYear() === currYear;
      })
      .reduce((s, tx) => s + Number(tx.amount_usd ?? tx.amount ?? 0), 0);
  }, [transactions]);

  const monthlyBalance = currentMonthIncome - currentMonthExpenses;

  const monthlyIncomeSpark = useMemo(() => {
    const n = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const target = new Date(n.getFullYear(), n.getMonth() - (5 - i), 1);
      const tMo = target.getMonth();
      const tYr = target.getFullYear();

      return transactions
        .filter((tx) => {
          if (tx.type !== "income") return false;
          const dateStr = tx.date ? tx.date.replace(" ", "T") : "";
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return false;
          return d.getMonth() === tMo && d.getFullYear() === tYr;
        })
        .reduce((s, tx) => s + Number(tx.amount_usd ?? tx.amount ?? 0), 0);
    });
  }, [transactions]);

  const monthlyExpSpark = useMemo(() => {
    const n = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const target = new Date(n.getFullYear(), n.getMonth() - (5 - i), 1);
      const tMo = target.getMonth();
      const tYr = target.getFullYear();

      return transactions
        .filter((tx) => {
          if (tx.type !== "expense") return false;
          const dateStr = tx.date ? tx.date.replace(" ", "T") : "";
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return false;
          return d.getMonth() === tMo && d.getFullYear() === tYr;
        })
        .reduce((s, tx) => s + Number(tx.amount_usd ?? tx.amount ?? 0), 0);
    });
  }, [transactions]);

  const balanceSpark = useMemo(
    () => monthlyIncomeSpark.map((inc, i) => inc - monthlyExpSpark[i]),
    [monthlyIncomeSpark, monthlyExpSpark]
  );

  // ── Category Chart Data ──────────────────────────────────────────────
  const categoryChartData = useMemo(() => {
    // Parse selectedMonth "YYYY-MM" to year/month
    const [selYear, selMonth] = selectedMonth.split("-").map(Number);

    const dataMap: Record<string, number> = {};
    transactions.forEach(tx => {
      if (tx.type === chartType && !TRANSFER_CATEGORIES.includes(tx.category)) {
        const txDate = new Date(tx.date);
        const txYear = txDate.getFullYear();
        const txMonth = txDate.getMonth() + 1; // 1-indexed

        // Filter by selected month
        if (txYear === selYear && txMonth === selMonth) {
          dataMap[tx.category] = (dataMap[tx.category] || 0) + Number(tx.amount_usd ?? tx.amount);
        }
      }
    });
    return Object.entries(dataMap)
      .map(([cat, val]) => ({
        category: cat,
        label: getCategoryLabel(cat, lang),
        value: val,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, chartType, lang, selectedMonth]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="section-header-group">
          <h2 className="text-title-header">
            {t("Balance", "Balance")}
          </h2>
          <p className="text-description-header">
            {t("Cash flow overview and transaction history", "Flujo de efectivo e historial de transacciones")}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <BalanceKPIs
        balance={monthlyBalance}
        currentMonthIncome={currentMonthIncome}
        currentMonthExpenses={currentMonthExpenses}
        balanceSpark={balanceSpark}
        monthlyIncomeSpark={monthlyIncomeSpark}
        monthlyExpSpark={monthlyExpSpark}
      />

      {/* Category Chart */}
      <Card className="border-border backdrop-blur-md overflow-hidden flex flex-col p-4" style={{ borderColor: "var(--glass-border)", background: "var(--glass-bg)" }}>
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="section-header-group">
            <h3 className="text-[14px] font-semibold text-foreground">
              {t("By Category", "Por Categoría")}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[110px] h-8 bg-card/50 backdrop-blur-md border-[rgba(255,255,255,0.06)] text-[#F0F5F1] text-[12px] focus:ring-[#C8FF00]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-dropdown">
                {getMonthOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={chartType} onValueChange={(v: "income" | "expense") => setChartType(v)}>
              <SelectTrigger className="w-[120px] h-8 bg-card/50 backdrop-blur-md border-[rgba(255,255,255,0.06)] text-[#F0F5F1] text-[12px] focus:ring-[#C8FF00]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-dropdown">
                <SelectItem value="expense">
                  <span className="flex items-center gap-2">
                    <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
                    {t("Expenses", "Gastos")}
                  </span>
                </SelectItem>
                <SelectItem value="income">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-lime-500" />
                    {t("Income", "Ingresos")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto pb-2 scrollbar-hide">
          <div className="min-w-[500px] h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} layout="horizontal" margin={{ top: 10, right: 10, left: 8, bottom: 26 }}>
                <XAxis
                  dataKey="category"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  height={30}
                  tick={<CategoryIconTick />}
                />
                <YAxis
                  stroke="var(--color-text)"
                  tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  scale="log"
                  domain={[1, 'auto']}
                  tickFormatter={(v: number) => {
                    const sym = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
                    const abs = Math.abs(v);
                    const formatted = abs >= 10000
                      ? `${(abs / 1000).toFixed(0)}k`
                      : abs.toLocaleString("de-DE", { maximumFractionDigits: 0 });
                    return currency === "EUR" ? `${formatted} ${sym}` : `${sym}${formatted}`;
                  }}
                />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: 'var(--dialog-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '8px 12px' }}
                  itemStyle={{ color: chartType === "expense" ? 'var(--color-savings)' : 'var(--primary)', fontSize: '13px', fontWeight: 600 }}
                  labelFormatter={() => ""}
                  formatter={(value: number, _key: string, props: { payload?: { label?: string } }) => [
                    fmt(value),
                    props.payload?.label ?? ""
                  ]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartType === "expense" ? SEMANTIC_COLORS.savings : SEMANTIC_COLORS.income} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Transaction Table + Add/Edit Dialogs */}
      <TransactionTable
        transactions={transactions}
        loading={loading}
        session={session}
        onDelete={onDelete}
        onEdit={() => {}}
        onSaveEdit={onSaveEdit}
        onExportCSV={onExportCSV}
        onRefresh={onRefresh}
        onAdd={openAddDialog}
        addDialogOpen={addDialogOpen}
        onAddDialogOpenChange={(open) => { if (!open) setAddDialogOpen(false); }}
        addForm={addForm}
        onAddFormChange={setAddForm}
      />
    </div>
  );
}
