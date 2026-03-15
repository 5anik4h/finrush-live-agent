"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLang } from "@/contexts/LangContext";
import { SEMANTIC_COLORS } from "@/lib/colors";

/* ── Sparkline SVG helper ─────────────────────────────────────────── */
export function Sparkline({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1, w = 100;
  const pts = data.map(
    (v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4)}`
  );
  const uid = color.replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id={`mg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`0,${height} ${pts.join(" ")} ${w},${height}`}
        fill={`url(#mg-${uid})`}
        stroke="none"
      />
    </svg>
  );
}

interface BalanceKPIsProps {
  balance: number;
  currentMonthIncome: number;
  currentMonthExpenses: number;
  balanceSpark: number[];
  monthlyIncomeSpark: number[];
  monthlyExpSpark: number[];
}

export default function BalanceKPIs({
  balance,
  currentMonthIncome,
  currentMonthExpenses,
  balanceSpark,
  monthlyIncomeSpark,
  monthlyExpSpark,
}: BalanceKPIsProps) {
  const { t } = useLang();
  const { fmt } = useCurrency();
  const monthlySuffix = t("balance.monthly");

  const kpis = [
    {
      label: t("balance.title"),
      labelSuffix: monthlySuffix,
      value: balance,
      icon: Wallet,
      color: "var(--accent)",
      spark: balanceSpark,
      sparkColor: SEMANTIC_COLORS.investment,
    },
    {
      label: t("balance.income"),
      labelSuffix: monthlySuffix,
      value: currentMonthIncome,
      icon: TrendingUp,
      color: "var(--primary)",
      spark: monthlyIncomeSpark,
      sparkColor: SEMANTIC_COLORS.income,
    },
    {
      label: t("balance.expense"),
      labelSuffix: monthlySuffix,
      value: currentMonthExpenses,
      icon: TrendingDown,
      color: "var(--color-savings)",
      spark: monthlyExpSpark,
      sparkColor: SEMANTIC_COLORS.savings,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {kpis.map((kpi, kpiIdx) => (
        <motion.div
          key={kpi.label}
          className={kpiIdx === 0 ? "col-span-2 md:col-span-1" : "col-span-1"}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: kpiIdx * 0.07 }}
        >
          <div className="kpi-card flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className="w-3.5 h-3.5 shrink-0" style={{ color: kpi.color }} />
              <span className="kpi-label">
                {kpi.label}
                {"labelSuffix" in kpi && kpi.labelSuffix && (
                  <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                    {" "}{kpi.labelSuffix}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-end justify-between gap-2 overflow-hidden">
              <p className="kpi-value-responsive">{fmt(kpi.value)}</p>
              <div className={kpiIdx > 0 ? "hidden md:block" : "block"}>
                <Sparkline data={kpi.spark as unknown as number[]} color={kpi.sparkColor} />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
