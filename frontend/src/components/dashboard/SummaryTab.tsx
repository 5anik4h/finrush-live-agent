"use client";

import { useMemo } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLang } from "@/contexts/LangContext";
import { SEMANTIC_COLORS } from "@/lib/colors";
import { motion } from "framer-motion";
import { format, startOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Wallet, TrendingUp, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Session } from "@supabase/supabase-js";
import { useSnapshots } from "@/hooks/data/useSnapshots";
import { useNormalizedInvestmentValue } from "@/hooks/data/useInvestments";

interface Transaction {
  id: string;
  amount: number;
  amount_usd?: number;
  date: string;
  type: string;
  category: string;
}

interface SavingsPot {
  id: string;
  name: string;
  current_balance: number;
  current_balance_usd?: number;
  target_amount: number | null;
}

interface Snapshot {
  year: number;
  month: number;
  balance: number;
  investment_value: number;
  savings_value: number;
  net_worth: number;
}

interface ResumenTabProps {
  transactions: Transaction[];
  savingsPots: SavingsPot[];
  session?: Session | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip shadow-xl">
      <p className="type-label mb-1.5">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {entry.value < 0 ? "-" : ""}{formatter(Math.abs(entry.value))}
        </p>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomPieLabel({ cx, cy, midAngle, outerRadius, percent, name }: any) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 12; // Reduced distance to keep labels within SVG
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.01) return null;
  return (
    <text
      x={x}
      y={y}
      fill={"var(--muted-foreground)"}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={10}
      className="font-medium"
    >
      {name} {(percent * 100).toFixed(1)}%
    </text>
  );
}

export default function ResumenTab({ transactions, savingsPots, session }: ResumenTabProps) {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const { fmt, currency } = useCurrency();

  const userId = session?.user?.id ?? null;
  const accessToken = session?.access_token ?? null;
  const { snapshots } = useSnapshots(userId, accessToken);

  // Fetch normalized investment value (in USD, with all 10 asset types properly calculated)
  const refreshTrigger = 0; // Will be updated if we add auto-refresh
  const { value: investmentValue } = useNormalizedInvestmentValue(userId, refreshTrigger);

  // ── KPIs ────────────────────────────────────────────────────────────────
  // User wants "Balance" in Summary to be "Income - Expenses" for the CURRENT MONTH.
  // But for Net Worth, we need the CUMULATIVE Balance (Total Income - Total Expenses).
  const { totalBalance } = useMemo(() => {
    const now = new Date();
    const currMonth = now.getMonth();
    const currYear = now.getFullYear();

    let mInc = 0;
    let mExp = 0;
    let tInc = 0;
    let tExp = 0;

    for (const tx of transactions) {
      const val = Number(tx.amount_usd ?? tx.amount ?? 0);
      if (isNaN(val)) continue;

      // Ensure date parsing is robust (replace space with T for ISO)
      const dateStr = tx.date ? tx.date.replace(" ", "T") : "";
      const d = new Date(dateStr);
      const isInvalid = isNaN(d.getTime());

      const isThisMonth = !isInvalid && d.getMonth() === currMonth && d.getFullYear() === currYear;

      if (tx.type === "income") {
        tInc += val;
        if (isThisMonth) mInc += val;
      } else {
        tExp += val;
        if (isThisMonth) mExp += val;
      }
    }
    return {
      monthlyBalance: Number((mInc - mExp).toFixed(2)),
      totalBalance: Number((tInc - tExp).toFixed(2))
    };
  }, [transactions]);

  const savingsTotal = useMemo(
    () => Number(savingsPots.reduce((s, pot) => s + Number(pot.current_balance_usd ?? pot.current_balance ?? 0), 0).toFixed(2)),
    [savingsPots]
  );

  // ── Monthly data for line chart (last 12 months) ──────────────────────
  // Uses snapshots for closed months, falls back to tx-based calculation
  const monthlyData = useMemo(() => {
    const today = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(startOfMonth(today), 11),
      end: startOfMonth(today),
    });

    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Build snapshot lookup map
    const snapMap = new Map<string, Snapshot>();
    for (const s of snapshots) {
      snapMap.set(`${s.year}-${s.month}`, s);
    }

    // Build raw monthly data first
    const raw = months.map((m) => {
      const label = format(m, "MMM yy");
      const yr = m.getFullYear();
      const mo = m.getMonth() + 1; // 1-indexed
      const isCurrentMonth = m.getMonth() === currentMonth && yr === currentYear;

      // For closed months with snapshot data, use snapshot
      const snap = !isCurrentMonth ? snapMap.get(`${yr}-${mo}`) : undefined;

      const monthInc = transactions
        .filter(
          (tx) =>
            tx.type === "income" &&
            new Date(tx.date).getMonth() === m.getMonth() &&
            new Date(tx.date).getFullYear() === yr
        )
        .reduce((s, tx) => s + Number(tx.amount_usd ?? tx.amount), 0);

      const monthExp = transactions
        .filter(
          (tx) =>
            tx.type === "expense" &&
            new Date(tx.date).getMonth() === m.getMonth() &&
            new Date(tx.date).getFullYear() === yr
        )
        .reduce((s, tx) => s + Number(tx.amount_usd ?? tx.amount), 0);

      return { label, monthInc, monthExp, snap, isCurrentMonth };
    });

    // Accumulate
    type Acc = { label: string; balance: number; savings: number; investment: number; total: number };
    const { result } = raw.reduce<{ result: Acc[]; cumBal: number }>(
      (acc, { label, monthInc, monthExp, snap, isCurrentMonth }) => {
        if (snap && !isCurrentMonth) {
          // Use snapshot data for closed months
          return {
            result: [
              ...acc.result,
              {
                label,
                balance: snap.balance,
                savings: snap.savings_value,
                investment: snap.investment_value,
                total: snap.net_worth,
              },
            ],
            cumBal: snap.balance,
          };
        }
        // Calculate from transactions
        const newBal = acc.cumBal + (monthInc - monthExp);
        return {
          result: [
            ...acc.result,
            {
              label,
              balance: Math.round(newBal * 100) / 100,
              savings: Math.round(savingsTotal * 100) / 100,
              investment: Math.round(investmentValue * 100) / 100,
              total: Math.round((newBal + investmentValue + savingsTotal) * 100) / 100,
            },
          ],
          cumBal: newBal,
        };
      },
      { result: [], cumBal: 0 }
    );
    return result;
  }, [transactions, investmentValue, savingsTotal, snapshots]);

  // ── Pie data ─────────────────────────────────────────────────────────
  const { pieData, breakdownData } = useMemo(() => {
    const isEs = lang === "es";
    const data = [
      { name: isEs ? "Balance" : "Balance", value: totalBalance, color: SEMANTIC_COLORS.income },
      { name: isEs ? "Inversión" : "Investment", value: investmentValue, color: SEMANTIC_COLORS.investment },
      { name: isEs ? "Ahorro" : "Savings", value: savingsTotal, color: SEMANTIC_COLORS.savings },
    ];
    
    // For visual pie slices: only positive values
    const visualData = data.filter(d => d.value > 0);
    const pieData = visualData.length ? visualData : [{ name: "—", value: 1, color: "var(--muted-foreground)" }];
    
    // For breakdown list: everything
    return { pieData, breakdownData: data };
  }, [totalBalance, investmentValue, savingsTotal, lang]);

  const patrimonio = totalBalance + investmentValue + savingsTotal;

  const kpis = [
    {
      label: t("Total Balance", "Balance Total"),
      value: totalBalance,
      color: "var(--color-income)",
      icon: Wallet,
    },
    {
      label: t("Investment", "Inversión"),
      value: investmentValue,
      color: "var(--color-investment)",
      icon: TrendingUp,
    },
    {
      label: t("Savings", "Ahorro"),
      value: savingsTotal,
      color: "var(--color-savings)",
      icon: PiggyBank,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Patrimonio Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card-accent flex flex-col justify-center items-center text-center overflow-hidden rounded-xl"
        style={{
          padding: "1rem 1rem",
          background: "linear-gradient(135deg, rgba(200,255,0,0.14) 0%, rgba(179,136,255,0.12) 100%)",
          border: "1px solid rgba(200,255,0,0.18)",
        }}
      >
        <p className="type-label justify-center mb-2">
          {t("NET WORTH", "PATRIMONIO NETO")}
        </p>
        <p className="kpi-value-hero mb-1">
          {fmt(patrimonio)}
        </p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            className="kpi-card transition-all duration-300 hover:bg-white/10 flex flex-col justify-center overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <kpi.icon className="w-3.5 h-3.5 shrink-0" style={{ color: kpi.color }} />
              <span className="kpi-label truncate whitespace-nowrap text-ellipsis text-xs sm:text-sm">{kpi.label}</span>
            </div>
            <p
              className="kpi-value-responsive"
              style={{ color: kpi.value >= 0 ? kpi.color : "var(--destructive)" }}
            >
              {fmt(kpi.value)}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Line Chart — Evolution */}
        <Card className="border-border backdrop-blur-md">
          <CardHeader className="pb-2 px-5 pt-5 section-header-group">
            <CardTitle className="text-title-header">
              {t("Wealth Evolution (12 months)", "Evolución Patrimonial")}
            </CardTitle>
            <CardDescription className="text-description-header">
              {t("Balance, investment and savings over time", "Balance, inversión y ahorro en el tiempo")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5 px-2">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  axisLine={false}
                  width={56}
                  domain={[0, 'auto']}
                  tickFormatter={(v: number) => {
                    const sym = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
                    const abs = Math.abs(v);
                    const formatted = abs >= 10000
                      ? `${(abs / 1000).toFixed(0)}k`
                      : abs.toLocaleString("de-DE", { maximumFractionDigits: 0 });
                    const sign = v < 0 ? "−" : "";
                    return currency === "EUR" ? `${sign}${formatted} ${sym}` : `${sign}${sym}${formatted}`;
                  }}
                />
                <Tooltip content={<CustomTooltip formatter={fmt} />} />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name={t("Balance", "Balance")}
                  stroke={"var(--primary)"}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--primary)" }}
                />
                <Line
                  type="monotone"
                  dataKey="investment"
                  name={t("Investment", "Inversión")}
                  stroke={"var(--accent)"}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--accent)" }}
                />
                <Line
                  type="monotone"
                  dataKey="savings"
                  name={t("Savings", "Ahorro")}
                  stroke={SEMANTIC_COLORS.savings}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: SEMANTIC_COLORS.savings }}
                />
              </LineChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 justify-center mt-2 px-4">
              {[
                { color: "var(--primary)", label: t("Balance", "Balance") },
                { color: "var(--accent)", label: t("Investment", "Inversión") },
                { color: SEMANTIC_COLORS.savings, label: t("Savings", "Ahorro") },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div
                    className="w-5 rounded-full"
                    style={{ height: 2, background: item.color }}
                  />
                  <span
                    className="text-[10px] text-muted-foreground font-medium"
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart — Distribution */}
        <Card className="border-border backdrop-blur-md">
          <CardHeader className="pb-2 px-5 pt-5 section-header-group">
            <CardTitle className="text-title-header">
              {t("Wealth Distribution", "Distribución de Patrimonio")}
            </CardTitle>
            <CardDescription className="text-description-header">
              {t("Current allocation of your wealth", "Composición actual de tu patrimonio")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5 flex flex-col md:flex-row items-center gap-6">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart margin={{ left: 30, right: 30 }}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                  label={CustomPieLabel}
                  isAnimationActive={true}
                  animationDuration={1000}
                  stroke="none"
                  style={{ outline: "none", cursor: "default" }}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} style={{ outline: "none" }} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Breakdown list */}
            <div className="flex flex-col gap-3 w-full max-w-[180px]">
              {breakdownData.map((item) => {
                const totalPositive = breakdownData.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
                const pct = ((Math.max(0, item.value) / totalPositive) * 100).toFixed(1);
                return (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-[12px] text-muted-foreground font-medium">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[12px] font-bold" style={{ color: item.color }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
