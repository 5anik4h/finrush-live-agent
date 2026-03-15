"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { format, startOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PiggyBank, TrendingUp, Target, Percent } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLang } from "@/contexts/LangContext";
import { PIE_COLORS } from "@/lib/colors";

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
  target_amount_usd?: number;
}

interface SavingsTabProps {
  transactions: Transaction[];
  savingsPots: SavingsPot[];
}



// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip shadow-xl">
      <p className="type-label mb-1.5">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: entry.color ?? (entry.value >= 0 ? "var(--primary)" : "#FFAA33") }}>
          {entry.name}: {entry.value < 0 ? "-" : ""}{formatter(Math.abs(entry.value))}
        </p>
      ))}
    </div>
  );
}

export default function SavingsTab({ transactions, savingsPots }: SavingsTabProps) {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const { fmt, currency } = useCurrency();

  // ── Savings totals from pots ──────────────────────────────────────
  const totalInPots = useMemo(
    () => savingsPots.reduce((s, p) => s + Number(p.current_balance_usd ?? p.current_balance ?? 0), 0),
    [savingsPots]
  );
  const activePots = savingsPots.length;

  // ── Monthly contributions/withdrawals from transactions ───────────
  const monthlyData = useMemo(() => {
    const today = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(startOfMonth(today), 11),
      end: startOfMonth(today),
    });

    const raw = months.map((m) => {
      const label = format(m, "MMM yy");
      const contributions = transactions
        .filter(
          (tx) =>
            tx.category === "savings_contribution" &&
            new Date(tx.date).getMonth() === m.getMonth() &&
            new Date(tx.date).getFullYear() === m.getFullYear()
        )
        .reduce((s, tx) => s + Number(tx.amount_usd ?? tx.amount), 0);

      const withdrawals = transactions
        .filter(
          (tx) =>
            tx.category === "savings_withdrawal" &&
            new Date(tx.date).getMonth() === m.getMonth() &&
            new Date(tx.date).getFullYear() === m.getFullYear()
        )
        .reduce((s, tx) => s + Number(tx.amount_usd ?? tx.amount), 0);

      const monthIncome = transactions
        .filter(
          (tx) =>
            tx.type === "income" &&
            new Date(tx.date).getMonth() === m.getMonth() &&
            new Date(tx.date).getFullYear() === m.getFullYear()
        )
        .reduce((s, tx) => s + Number(tx.amount_usd ?? tx.amount), 0);

      return {
        label,
        contributions: Math.round(contributions),
        withdrawals: Math.round(withdrawals),
        net: Math.round(contributions - withdrawals),
        income: Math.round(monthIncome),
      };
    });

    type Entry = { label: string; contributions: number; withdrawals: number; net: number; income: number; cumulative: number };
    const { result } = raw.reduce<{ result: Entry[]; cum: number }>(
      (acc, m) => {
        const newCum = acc.cum + m.net;
        return { result: [...acc.result, { ...m, cumulative: newCum }], cum: newCum };
      },
      { result: [], cum: 0 }
    );
    return result;
  }, [transactions]);

  // ── Savings rate (this month) ─────────────────────────────────────
  const currentMonth = monthlyData[monthlyData.length - 1];
  const savingsRate = currentMonth && currentMonth.income > 0
    ? Math.round((currentMonth.contributions / currentMonth.income) * 100)
    : 0;

  // ── Symmetric domain so 0 is always centred on Y axis ──────────────
  const netYDomain = useMemo(() => {
    const vals = monthlyData.map(d => d.net);
    const max = Math.max(...vals.map(Math.abs), 1);
    return [-Math.ceil(max * 1.2), Math.ceil(max * 1.2)] as [number, number];
  }, [monthlyData]);

  // ── Best month ────────────────────────────────────────────────────
  const bestMonth = monthlyData.reduce(
    (best, m) => (m.contributions > best.contributions ? m : best),
    monthlyData[0] ?? { contributions: 0, label: "—" }
  );

  // ── Pie data for pot distribution ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const pieData = useMemo(() => {
    const data = savingsPots
      .filter((p) => Number(p.current_balance_usd ?? p.current_balance) > 0)
      .map((p, i) => ({
        name: p.name,
        value: Number(p.current_balance_usd ?? p.current_balance),
        color: PIE_COLORS[i % PIE_COLORS.length],
      }));
    return data.length ? data : [{ name: "—", value: 1, color: "var(--muted-foreground)" }];
  }, [savingsPots]);

  const kpis = [
    {
      label: t("Total Pots", "Total Huchas"),
      value: fmt(totalInPots, 0),
      icon: PiggyBank,
      color: "var(--primary)",
      positive: true,
    },
    {
      label: t("Active Pots", "Huchas Activas"),
      value: String(activePots),
      icon: Target,
      color: "var(--accent)",
      positive: true,
    },
    {
      label: t("Savings Rate", "Tasa Ahorro"),
      value: `${savingsRate}%`,
      icon: Percent,
      color: "#FFAA33",
      positive: savingsRate > 0,
    },
    {
      label: t("This Month", "Este Mes"),
      value: currentMonth ? fmt(currentMonth.net, 0) : "—",
      icon: TrendingUp,
      color: "var(--primary)",
      positive: currentMonth ? currentMonth.net >= 0 : true,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Best month highlight */}
      {bestMonth && bestMonth.contributions > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="glass-card-accent rounded-xl px-6 py-4 flex items-center justify-between gap-4 overflow-hidden relative"
          style={{
            background: "linear-gradient(90deg, rgba(200,255,0,0.12) 0%, rgba(200,255,0,0.02) 100%)",
          }}
        >
          <div
            className="absolute -right-8 -top-8 w-24 h-24 rounded-full blur-3xl opacity-20"
            style={{ background: "var(--primary)" }}
          />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-[24px]" style={{ background: "rgba(200,255,0,0.15)" }}>
              🏆
            </div>
            <div>
              <p className="text-[14px] font-black uppercase tracking-wider text-primary">
                {t("Best month:", "Mejor mes:")} {bestMonth.label}
              </p>
              <p className="text-[13px] font-medium text-muted-foreground font-medium">
                {t("You saved", "Ahorraste")} <span className="text-white font-bold">{fmt(bestMonth.contributions, 0)}</span>
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
          >
            <div className="kpi-card flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2 min-w-0">
                <kpi.icon className="w-3.5 h-3.5 shrink-0" style={{ color: kpi.color }} />
                <span className="kpi-label truncate whitespace-nowrap text-ellipsis text-xs sm:text-sm">{kpi.label}</span>
              </div>
              <p
                className="kpi-value"
                style={{ color: kpi.positive ? "var(--foreground)" : "var(--color-savings)" }}
              >
                {kpi.value}
              </p>
            </div>
          </motion.div>
        ))}
      </div>



      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly Contributions BarChart */}
        <Card className="border-border backdrop-blur-md">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-title-header">
              {t("Monthly Savings", "Ahorro Mensual")}
            </CardTitle>
            <CardDescription className="text-description-header">
              {t("Net savings per month", "Ahorro neto por mes")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5 px-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                  domain={netYDomain}
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
                <Tooltip content={<CustomTooltip formatter={(v: number) => fmt(v, 0)} />} cursor={false} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
                <Bar dataKey="net" name={t("Net Savings", "Ahorro Neto")} radius={[4, 4, 0, 0]}>
                  {monthlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.net >= 0 ? "#C8FF00" : "#FFAA33"} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cumulative Savings LineChart */}
        <Card className="border-border backdrop-blur-md">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-title-header">
              {t("Cumulative Net Savings", "Ahorro Neto Acumulado")}
            </CardTitle>
            <CardDescription className="text-description-header">
              {t("Net deposits into savings pots over time", "Depósitos netos en huchas a lo largo del tiempo")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5 px-2">
            <ResponsiveContainer width="100%" height={200}>
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
                  tickLine={false}
                  width={56}
                  domain={['auto', 'auto']}
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
                <Tooltip content={<CustomTooltip formatter={(v: number) => fmt(v, 0)} />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  name={t("Cumulative", "Acumulado")}
                  stroke={"var(--accent)"}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--accent)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
