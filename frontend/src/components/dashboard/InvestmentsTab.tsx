"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Session } from "@supabase/supabase-js";
import { format } from "date-fns";
import { AlertCircle, BarChart2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, LineChart, Line, ReferenceLine, BarChart, Bar } from "recharts";
import { ASSET_TYPES, getAssetTypeLabel, AssetType } from "@/lib/categories";
import { ASSET_TYPE_ICON_META } from "@/lib/categoryIcons";
import { convertFromUSD, fmtCurrency, type Currency } from "@/lib/currency";
import { es as esLocale } from "date-fns/locale";
import {
  getInvestmentsByType,
  updateInvestmentPrice,
  updateGroupBInterest,
  insertInvestment,
  updateInvestment,
  deleteInvestment,
  calcCompoundInterest,
} from "@/services/investments";
import { GROUP_B_ASSET_TYPES } from "@/lib/categories";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLang } from "@/contexts/LangContext";
import { PIE_COLORS as COLORS, SEMANTIC_COLORS } from "@/lib/colors";
import { normalise } from "@/lib/investment-normalize";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Subcomponents
import InvestmentNavPills from "./investments/InvestmentNavPills";
import InvestmentTable, { type InvRow, type ColDef, getColumns } from "./investments/InvestmentTable";
import InvestmentForm, { getFormFields } from "./investments/InvestmentForm";
import TypePickerDialog from "./investments/TypePickerDialog";

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */

const PRICE_FETCH_TYPES: AssetType[] = ["stock", "crypto", "etf", "commodity"];

const ROWS_PER_PAGE = 10;

/* ═══════════════════════════════════════════════
   PRICE FETCHER
   ═══════════════════════════════════════════════ */
async function fetchPrice(ticker: string, assetType: AssetType): Promise<number | null> {
  try {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws/agent";
    const API_BASE = WS_URL.replace("ws://", "http://").replace("wss://", "https://").replace("/ws/agent", "");
    const url = `${API_BASE}/api/prices/${ticker}?asset_type=${assetType}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.price ?? null;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════
   CURRENCY RESOLUTION (mirrors backend resolve_currency)
   ═══════════════════════════════════════════════ */

/**
 * Convert an amount in `currency` to USD using live fxRates.
 * fxRates: Record<Currency, number> where rate = foreign_units_per_1_USD
 *   e.g. { EUR: 0.92, GBP: 0.79, USD: 1 }
 *
 * Returns { amountUsd, rateAtEntry }
 *   rateAtEntry = 1 / fxRates[currency]  → USD per 1 unit of currency
 */
function resolveToUsd(
  amount: number,
  currency: string,
  fxRates: Record<string, number>
): { amountUsd: number; rateAtEntry: number } {
  if (!amount || currency === "USD") return { amountUsd: amount, rateAtEntry: 1 };
  const rateVsForeign = fxRates[currency as Currency] ?? 1; // foreign per 1 USD
  const rateAtEntry = rateVsForeign > 0 ? 1 / rateVsForeign : 1; // USD per 1 foreign unit
  const amountUsd = parseFloat((amount * rateAtEntry).toFixed(6));
  return { amountUsd, rateAtEntry };
}

/* ═══════════════════════════════════════════════
   CHART TOOLTIPS
   ═══════════════════════════════════════════════ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip shadow-xl" style={{ border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
      <p className="type-label mb-1.5">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <p key={i} className="text-[12px] font-bold" style={{ color: entry.color }}>
          {entry.name && entry.name !== "value" ? `${entry.name}: ` : ""}{formatter(entry.value)}
        </p>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PNLTooltip({ active, payload, label, fmtFn }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip shadow-xl" style={{ border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
      <p className="type-label mb-1.5">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <p key={i} className="text-[12px] font-bold" style={{ color: entry.color }}>
          {entry.name}: {entry.value >= 0 ? "+" : "−"}{fmtFn(Math.abs(entry.value))}
        </p>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════ */
interface InversionTabProps {
  session: Session | null;
  refreshKey?: number;
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function InversionTab({ session, refreshKey }: InversionTabProps) {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);

  // Currency — always use global selector
  const { currency: globalCurrency, rates: fxRates } = useCurrency();
  const toDisplay = useCallback((usd: number) => convertFromUSD(usd, globalCurrency, fxRates), [globalCurrency, fxRates]);
  const fmt = useCallback((usd: number, dec = 2) => fmtCurrency(toDisplay(usd), globalCurrency, dec), [toDisplay, globalCurrency]);

  // Data
  const [allRows, setAllRows] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  // Navigation
  const [activePill, setActivePill] = useState<AssetType | "all">("stock");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(0);
  const [histMonth, setHistMonth] = useState<string>("all");
  const [histYear, setHistYear] = useState<string>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<AssetType>("stock");
  const [editRow, setEditRow] = useState<InvRow | null>(null);
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  // Price update
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceCooldown, setPriceCooldown] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("inv_price_cooldown");
      if (stored) {
        const ts = parseInt(sessionStorage.getItem("inv_price_cooldown_ts") || "0", 10);
        const elapsed = Math.floor((Date.now() - ts) / 1000);
        const remaining = parseInt(stored, 10) - elapsed;
        return remaining > 0 ? remaining : 0;
      }
    }
    return 0;
  });
  const [priceError, setPriceError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [priceUpdatesGlobalEnabled, setPriceUpdatesGlobalEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("finrush_price_updates_enabled") !== "false";
  });

  // Chart
  const [pnlPeriod, setPnlPeriod] = useState<"all" | "year" | "month" | "week">("all");

  /* ── Fetch all investments ──────────────────────────────── */
  const fetchAll = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setDbError(false);
    const rows: InvRow[] = [];
    try {
      for (const typeEntry of ASSET_TYPES) {
        const type = typeEntry.value as AssetType;
        try {
          const data = await getInvestmentsByType(session.user.id, type);
          for (const row of data) rows.push(normalise(type, row));
        } catch (err) {
          console.error(`Error fetching ${type}:`, err);
        }
      }
      setAllRows(rows);
    } catch {
      setDbError(true);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => fetchAll(), 0);
    return () => clearTimeout(timer);
  }, [fetchAll, refreshKey]);

  // Update Group B accumulated_interest on mount (throttled: once per 30 min per session)
  const groupBUpdatedRef = useRef(false);
  useEffect(() => {
    if (!session || groupBUpdatedRef.current || allRows.length === 0) return;
    groupBUpdatedRef.current = true;
    const groupBRows = allRows.filter((r) => GROUP_B_ASSET_TYPES.includes(r.asset_type as typeof GROUP_B_ASSET_TYPES[number]));
    if (groupBRows.length === 0) return;
    void (async () => {
      for (const r of groupBRows) {
        try {
          const startDate = String(r.raw.start_date ?? new Date().toISOString().slice(0, 10));
          // All Group B types unified: quantity + apy
          const qty = Number(r.raw.quantity ?? 0);
          const accrued = calcCompoundInterest(
            qty,
            Number(r.raw.apy ?? 0),
            String(r.raw.frequency ?? "monthly"),
            startDate
          );
          const current = Math.max(Number(r.raw.accumulated_interest ?? 0), accrued);
          await updateGroupBInterest(r.asset_type, r.id, current);
        } catch {
          // Non-critical: silently skip if update fails
        }
      }
    })();
  }, [session, allRows]);

  // Listen for global price-updates toggle changes from SettingsPopup
  useEffect(() => {
    const handler = () => {
      setPriceUpdatesGlobalEnabled(localStorage.getItem("finrush_price_updates_enabled") !== "false");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    if (priceCooldown > 0) {
      if (typeof window !== "undefined" && !sessionStorage.getItem("inv_price_cooldown")) {
        sessionStorage.setItem("inv_price_cooldown", priceCooldown.toString());
        sessionStorage.setItem("inv_price_cooldown_ts", Date.now().toString());
      }
      if (!cooldownRef.current) {
        cooldownRef.current = setInterval(() => {
          setPriceCooldown((c) => {
            if (c <= 1) {
              if (cooldownRef.current) clearInterval(cooldownRef.current);
              if (typeof window !== "undefined") sessionStorage.removeItem("inv_price_cooldown");
              return 0;
            }
            return c - 1;
          });
        }, 1000);
      }
    }
    return () => {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
    };
  }, [priceCooldown]);

  /* ── Derived data ──────────────────────────────────────── */
  const grouped = useMemo(() => {
    const map: Partial<Record<AssetType, InvRow[]>> = {};
    for (const row of allRows) {
      if (!map[row.asset_type]) map[row.asset_type] = [];
      map[row.asset_type]!.push(row);
    }
    return map;
  }, [allRows]);

  const totalValue = useMemo(() => allRows.reduce((s, r) => s + r.current_value, 0), [allRows]);
  const totalCost = useMemo(() => allRows.reduce((s, r) => s + r.invested_amount, 0), [allRows]);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  const activeRows = useMemo(() => {
    let rows: InvRow[] = activePill === "all" ? allRows : (grouped[activePill] ?? []);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      rows = rows.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        String(r.raw.ticker ?? "").toLowerCase().includes(q) ||
        String(r.raw.currency ?? "").toLowerCase().includes(q)
      );
    }
    if (histMonth !== "all" || histYear !== "all") {
      rows = rows.filter((r) => {
        const rawDate = r.raw.date || r.raw.purchase_date || r.raw.start_date || r.raw.buy_date || r.raw.created_at;
        if (!rawDate) return true;
        const txDate = new Date(String(rawDate));
        let matchMonth = true;
        let matchYear = true;
        if (histMonth !== "all") matchMonth = txDate.getMonth() === parseInt(histMonth);
        if (histYear !== "all") matchYear = txDate.getFullYear() === parseInt(histYear);
        return matchMonth && matchYear;
      });
    }
    return rows;
  }, [activePill, allRows, grouped, searchQ, histMonth, histYear]);

  const totalPages = Math.max(1, Math.ceil(activeRows.length / ROWS_PER_PAGE));
  const pageRows = useMemo(() => activeRows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE), [activeRows, page]);

  // Reset page when pill/search changes
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(0); }, [activePill, searchQ]);

  const distChartData = useMemo(() => {
    if (activePill === "all") {
      return Object.entries(grouped).map(([type, rows]) => ({
        name: getAssetTypeLabel(type as AssetType, lang),
        value: rows.reduce((s, r) => s + r.current_value, 0),
        fill: (ASSET_TYPE_ICON_META[type as AssetType] || ASSET_TYPE_ICON_META.other).color,
      })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    } else {
      return activeRows.map((r, i) => ({
        name: r.name,
        value: r.current_value,
        fill: COLORS[i % COLORS.length],
      })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    }
  }, [activeRows, activePill, grouped, lang]);

  const pnlChartData = useMemo(() => {
    const now = new Date();
    let threshold = new Date(now);
    const interval: Date[] = [];
    let formatStr = "dd MMM";

    if (pnlPeriod === "year") {
      threshold = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      for (let d = new Date(threshold); d <= now; d.setDate(d.getDate() + 7)) interval.push(new Date(d));
      formatStr = "MMM yy";
    } else if (pnlPeriod === "month") {
      threshold = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      for (let d = new Date(threshold); d <= now; d.setDate(d.getDate() + 1)) interval.push(new Date(d));
    } else if (pnlPeriod === "week") {
      threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      for (let d = new Date(threshold); d <= now; d.setDate(d.getDate() + 1)) interval.push(new Date(d));
    } else {
      threshold = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
      for (let d = new Date(threshold); d <= now; d.setMonth(d.getMonth() + 1)) interval.push(new Date(d));
      formatStr = "MMM yy";
    }

    return interval.map(date => {
      const label = format(date, formatStr, { locale: lang === "es" ? esLocale : undefined });
      const endOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      let totalVal = 0, totalCostLocal = 0;
      for (const r of allRows) {
        const rawDate = r.raw.date || r.raw.purchase_date || r.raw.start_date || r.raw.buy_date || r.raw.created_at;
        if (rawDate && new Date(String(rawDate)) <= endOfDate) {
          totalVal += r.current_value;
          totalCostLocal += r.invested_amount;
        }
      }
      return { label, pnl: Math.round((totalVal - totalCostLocal) * 100) / 100 };
    });
  }, [allRows, pnlPeriod, lang]);

  const investmentBarData = useMemo(() => {
    return ASSET_TYPES.map(typeEntry => {
      const type = typeEntry.value as AssetType;
      const typeRows = grouped[type] ?? [];
      const val = typeRows.reduce((s, r) => s + r.current_value, 0);
      return {
        name: lang === "es" ? typeEntry.label_es : typeEntry.label_en,
        value: Math.round(val),
        fill: (ASSET_TYPE_ICON_META[type] || ASSET_TYPE_ICON_META.other).color,
      };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [grouped, lang]);

  const pnlTypes = useMemo(() => ASSET_TYPES.filter(td => allRows.some(r => r.asset_type === td.value)), [allRows]);

  const columns: ColDef[] = useMemo(() => {
    const effectiveType: AssetType = activePill === "all" ? "stock" : activePill;
    return getColumns(effectiveType);
  }, [activePill]);

  /* ── Price update ──────────────────────────────────────── */
  const handlePriceUpdate = async () => {
    if (priceCooldown > 0 || allRows.length === 0) return;
    setPriceLoading(true);
    setPriceError(null);
    const updatable = allRows.filter((r) => PRICE_FETCH_TYPES.includes(r.asset_type) && r.raw.ticker);
    const results = await Promise.allSettled(
      updatable.map(async (r) => {
        const ticker = String(r.raw.ticker);
        const price = await fetchPrice(ticker, r.asset_type);
        if (price !== null) {
          await updateInvestmentPrice(r.asset_type, r.id, price);
        } else if (r.raw.current_price == null || Number(r.raw.current_price) === 0) {
          const fallbackPrice = Number(r.raw.buy_price ?? 0);
          if (fallbackPrice > 0) await updateInvestmentPrice(r.asset_type, r.id, fallbackPrice);
        }
        return { id: r.id, price };
      })
    );
    const updated = results.filter((r) => r.status === "fulfilled" && r.value.price !== null).length;
    if (updated === 0 && updatable.length > 0) {
      setPriceError(t(
        "Could not fetch prices. The price service may be unavailable.",
        "No se pudieron obtener precios. El servicio puede no estar disponible."
      ));
    }
    setLastUpdated(new Date());
    setPriceLoading(false);
    await fetchAll();
    setPriceCooldown(60);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("inv_price_cooldown", "60");
      sessionStorage.setItem("inv_price_cooldown_ts", Date.now().toString());
    }
  };

  /* ── CRUD ──────────────────────────────────────────────── */
  const openCreate = (type: AssetType) => {
    setEditRow(null);
    setDialogType(type);
    const defaults: Record<string, string | boolean> = {};
    for (const f of getFormFields(type)) {
      if (f.type === "toggle") defaults[f.key] = false;
      else if (f.type === "date") defaults[f.key] = format(new Date(), "yyyy-MM-dd");
      else defaults[f.key] = "";
    }
    // Add currency field defaulting to user's selected currency
    defaults.currency = globalCurrency;
    // Group B: default frequency to "monthly"
    if (GROUP_B_ASSET_TYPES.includes(type as typeof GROUP_B_ASSET_TYPES[number])) {
      defaults.frequency = "monthly";
    }
    setFormData(defaults);
    setTypePickerOpen(false);
    setDialogOpen(true);
  };

  const openEdit = (row: InvRow) => {
    setEditRow(row);
    setDialogType(row.asset_type);
    const data: Record<string, string | boolean> = {};
    for (const f of getFormFields(row.asset_type)) {
      const val = row.raw[f.key];
      if (f.type === "toggle") data[f.key] = Boolean(val);
      else data[f.key] = val != null ? String(val) : "";
    }
    // Populate currency from raw row (fall back to globalCurrency)
    data.currency = row.raw.currency != null ? String(row.raw.currency) : globalCurrency;
    setFormData(data);
    setDialogOpen(true);
  };

  const canSave = useMemo(() => {
    const fields = getFormFields(dialogType);
    const requiredOk = fields
      .filter((f) => f.required && (!f.condition || f.condition(formData)))
      .every((f) => {
        const v = formData[f.key];
        if (f.type === "number") return v !== "" && v !== undefined && !isNaN(Number(v));
        return v !== "" && v !== undefined;
      });
    if (PRICE_FETCH_TYPES.includes(dialogType)) {
      const hasQty = formData.quantity !== "" && formData.quantity !== undefined && !isNaN(Number(formData.quantity));
      const hasBp = formData.buy_price !== "" && formData.buy_price !== undefined && !isNaN(Number(formData.buy_price));
      const hasTotalAmount = formData.total_amount !== "" && formData.total_amount !== undefined && !isNaN(Number(formData.total_amount));
      if (!hasQty && !hasBp && !hasTotalAmount) return false;
    }
    return requiredOk;
  }, [dialogType, formData]);

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const fields = getFormFields(dialogType);
      const payload: Record<string, unknown> = { user_id: session.user.id };
      for (const f of fields) {
        const val = formData[f.key];
        if (f.type === "toggle") {
          payload[f.key] = Boolean(val);
        } else if (f.type === "number") {
          const n = parseFloat(String(val));
          if (!isNaN(n)) {
            payload[f.key] = n;
          }
        } else if (f.type === "date") {
          if (val) payload[f.key] = String(val);
        } else {
          const s = String(val ?? "").trim();
          if (s) payload[f.key] = f.uppercase ? s.toUpperCase() : s;
        }
      }
      // Add currency field from formData
      const entryCurrency = formData.currency ? String(formData.currency) : "USD";
      payload.currency = entryCurrency;

      if (PRICE_FETCH_TYPES.includes(dialogType)) {
        // Ensure name is never null (DB constraint). Fall back to ticker.
        if (!payload.name && payload.ticker) payload.name = payload.ticker;

        const field = "quantity";
        const qty = Number(payload[field] || 0);
        const bp = Number(payload.buy_price ?? 0);          // historical buy price (always from form)
        const cpFromForm = Number(payload.current_price ?? 0); // current price (from form if skip=true)
        const skipUpdate = Boolean(payload.skip_price_update);
        const totalAmt = Number(payload.total_amount || 0);
        delete payload.total_amount;

        // ── Resolve quantity from total_amount if needed ──
        if (qty <= 0 && totalAmt > 0) {
          const refPrice = bp > 0 ? bp : cpFromForm;
          if (refPrice > 0) {
            payload[field] = parseFloat((totalAmt / refPrice).toFixed(6));
          } else if (payload.ticker) {
            // No price at all — fetch live to derive qty
            const fetched = await fetchPrice(String(payload.ticker), dialogType);
            if (fetched !== null && fetched > 0) {
              payload[field] = parseFloat((totalAmt / fetched).toFixed(6));
              // live price becomes current_price
              if (!skipUpdate) payload.current_price = fetched;
            }
          }
        } else if (qty <= 0 && bp > 0) {
          // Only price given without qty or total → qty = 1 (agent usually handles this correctly)
          payload[field] = 1;
        }

        // ── Resolve current_price independently from buy_price ──
        if (skipUpdate) {
          // Manual mode: both prices come from form. current_price falls back to buy_price if empty.
          payload.buy_price = bp || 0;
          payload.current_price = cpFromForm || bp || 0;
        } else {
          // Auto mode: buy_price is the HISTORICAL price (always from form, never overwritten by live).
          // current_price is fetched live (skip_price_update=false means auto-refresh enabled).
          let livePrice: number | null = null;
          if (payload.ticker) {
            livePrice = await fetchPrice(String(payload.ticker), dialogType);
          }
          // buy_price = what the user paid (historical) — never replace with live price
          payload.buy_price = bp || 0;
          // current_price = live market price; fallback to buy_price if fetch fails
          payload.current_price = livePrice ?? cpFromForm ?? bp ?? 0;
        }

        // Ensure neither is null/missing (DB NOT NULL constraint)
        if (payload.buy_price == null || payload.buy_price === "") payload.buy_price = 0;
        if (payload.current_price == null || payload.current_price === "") payload.current_price = payload.buy_price;

        // Dual-storage: compute *_usd and rate_at_entry from entry currency
        const { amountUsd: bpUsd, rateAtEntry } = resolveToUsd(Number(payload.buy_price), entryCurrency, fxRates);
        const { amountUsd: cpUsd } = resolveToUsd(Number(payload.current_price), entryCurrency, fxRates);
        payload.buy_price_usd = bpUsd;
        payload.current_price_usd = cpUsd;
        payload.rate_at_entry = rateAtEntry;
      }
      // Dual-storage for non-Group-A types: compute *_usd and rate_at_entry
      if (!PRICE_FETCH_TYPES.includes(dialogType)) {
        const { rateAtEntry } = resolveToUsd(1, entryCurrency, fxRates);
        payload.rate_at_entry = rateAtEntry;
        // Group B: quantity → quantity_usd; accumulated_interest → accumulated_interest_usd
        if (["fixedincome", "account", "crowdlending"].includes(dialogType)) {
          if (payload.quantity != null) payload.quantity_usd = resolveToUsd(Number(payload.quantity), entryCurrency, fxRates).amountUsd;
          if (payload.accumulated_interest != null) payload.accumulated_interest_usd = resolveToUsd(Number(payload.accumulated_interest), entryCurrency, fxRates).amountUsd;
        }
        // Fund: buy_price → buy_price_usd; current_value → current_value_usd
        if (dialogType === "fund") {
          // Derive buy_price from total_amount / quantity if buy_price not provided
          const fundQty = Number(payload.quantity || 0);
          const fundTotal = Number(payload.total_amount || 0);
          if ((payload.buy_price == null || Number(payload.buy_price) === 0) && fundTotal > 0 && fundQty > 0) {
            payload.buy_price = parseFloat((fundTotal / fundQty).toFixed(6));
          }
          delete payload.total_amount;
          if (payload.buy_price != null) payload.buy_price_usd = resolveToUsd(Number(payload.buy_price), entryCurrency, fxRates).amountUsd;
          if (payload.current_value != null) payload.current_value_usd = resolveToUsd(Number(payload.current_value), entryCurrency, fxRates).amountUsd;
        }
        // Forex: quantity → quantity_usd
        if (dialogType === "forex") {
          if (payload.quantity != null) payload.quantity_usd = resolveToUsd(Number(payload.quantity), entryCurrency, fxRates).amountUsd;
        }
        // RealEstate: estimated_value, pending_mortgage, purchase_price, monthly_rent → *_usd
        if (dialogType === "realestate") {
          const reFields = ["estimated_value", "pending_mortgage", "purchase_price", "monthly_rent"];
          for (const f of reFields) {
            if (payload[f] != null) payload[`${f}_usd`] = resolveToUsd(Number(payload[f]), entryCurrency, fxRates).amountUsd;
          }
        }
      }

      if (editRow) await updateInvestment(dialogType, editRow.id, payload);
      else await insertInvestment(dialogType, payload);
      setSaving(false);
      setDialogOpen(false);
      await fetchAll();
    } catch (error) {
      console.error("Error saving investment:", error);
      alert(lang === "es" ? "Error al guardar inversión" : "Error saving investment");
      setSaving(false);
    }
  };

  const handleDelete = async (row: InvRow) => {
    if (!confirm(t(`Delete "${row.name}"?`, `¿Eliminar "${row.name}"?`))) return;
    setAllRows((prev) => prev.filter((r) => r.id !== row.id));
    await deleteInvestment(row.asset_type, row.id);
  };

  /* ─────────────────────────────────────────── */

  if (dbError) {
    return (
      <Alert className="alert-error">
        <AlertDescription className="text-[13px]">
          {t("Error loading investments. Please check your connection.", "Error al cargar inversiones. Comprueba tu conexión.")}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="section-header-group">
          <h2 className="text-title-header">{t("Investment Portfolio", "Inversión")}</h2>
          <p className="text-description-header">
            {lastUpdated
              ? `${t("Updated", "Actualizado")}: ${format(lastUpdated, lang === "es" ? "HH:mm 'del' d MMM" : "HH:mm 'on' MMM d")}`
              : t("All Asset Classes", "Todas las categorías")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {allRows.some((r) => PRICE_FETCH_TYPES.includes(r.asset_type)) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePriceUpdate}
              disabled={priceCooldown > 0 || allRows.length === 0 || !priceUpdatesGlobalEnabled || priceLoading}
              className={`btn-glass h-9 px-3 border-accent/25 text-investment hover:bg-accent/10 text-[12px] ${priceCooldown > 0 || !priceUpdatesGlobalEnabled ? "opacity-40" : ""} ${priceLoading ? "pointer-events-none" : ""}`}
              title={!priceUpdatesGlobalEnabled ? t("Price updates disabled in Settings", "Actualización de precios desactivada en Ajustes") : undefined}
            >
              <svg className={`w-3.5 h-3.5 mr-1.5 ${priceLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              {priceCooldown > 0 ? `${priceCooldown}s` : t("Update Prices", "Actualizar Precios")}
            </Button>
          )}
        </div>
      </div>

      {/* Price error */}
      <AnimatePresence>
        {priceError && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Alert className="alert-error">
              <AlertCircle className="h-4 w-4" style={{ color: "var(--color-savings)" }} />
              <AlertDescription className="text-[12px] text-muted-foreground font-medium">{priceError}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Summary */}
      {allRows.length > 0 && (
        <>
          <div className="hidden md:grid grid-cols-3 gap-4">
            <Card className="kpi-card flex flex-col justify-center items-start">
              <div className="kpi-label"><Wallet className="w-3 h-3 text-primary" />{t("Current Value", "Valor Actual")}</div>
              <p className="kpi-value">{fmt(totalValue)}</p>
            </Card>
            <Card className="kpi-card flex flex-col justify-center items-start">
              <div className="kpi-label"><BarChart2 className="w-3 h-3 text-savings" />{t("Total Investment", "Inversión Total")}</div>
              <p className="kpi-value">{fmt(totalCost)}</p>
            </Card>
            <Card className="kpi-card flex flex-col justify-center items-start">
              <div className="kpi-label">
                {totalGain >= 0 ? <TrendingUp className="w-3 h-3 text-accent" /> : <TrendingDown className="w-3 h-3 text-accent" />}
                {t("Total P&L", "Ganancia / Pérdida")}
              </div>
              <p className="kpi-value" style={{ color: totalGain >= 0 ? "var(--color-income)" : "var(--color-savings)" }}>
                {`${totalGain >= 0 ? "+" : "−"}${fmt(Math.abs(totalGain))} (${totalGainPct.toFixed(1)}%)`}
              </p>
            </Card>
          </div>

          {/* Mobile KPIs */}
          <div className="flex flex-col gap-4 md:hidden">
            <div className="grid grid-cols-2 gap-4">
              <Card className="kpi-card flex flex-col justify-center items-start overflow-hidden">
                <div className="kpi-label"><Wallet className="w-2.5 h-2.5 text-primary" />{t("Current Value", "Valor Actual")}</div>
                <p className="kpi-value">{fmt(totalValue)}</p>
              </Card>
              <Card className="kpi-card flex flex-col justify-center items-start overflow-hidden">
                <div className="kpi-label"><BarChart2 className="w-2.5 h-2.5 text-savings" />{t("Total Investment", "Inversión Total")}</div>
                <p className="kpi-value">{fmt(totalCost)}</p>
              </Card>
            </div>
            <Card className="kpi-card overflow-hidden">
              <CardContent className="p-0 flex items-center gap-3">
                <div className="flex-shrink-0 w-20 h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={allRows.map((r, i) => ({ i, v: r.pnl }))} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                      <defs>
                        <linearGradient id="plGradInv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={totalGain >= 0 ? SEMANTIC_COLORS.income : SEMANTIC_COLORS.savings} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={totalGain >= 0 ? SEMANTIC_COLORS.income : SEMANTIC_COLORS.savings} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke={totalGain >= 0 ? SEMANTIC_COLORS.income : SEMANTIC_COLORS.savings} strokeWidth={1.5} fill="url(#plGradInv)" dot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col items-end text-right min-w-0 flex-1">
                  <div className="kpi-label mb-2" style={{ justifyContent: "flex-end" }}>
                    {totalGain >= 0 ? <TrendingUp className="w-2.5 h-2.5 text-[#B388FF]" /> : <TrendingDown className="w-2.5 h-2.5 text-[#B388FF]" />}
                    {t("Total P&L", "Ganancia / Pérdida")}
                  </div>
                  <p className="kpi-value" style={{ color: totalGain >= 0 ? "var(--color-income)" : "var(--color-savings)" }}>
                    {totalGain >= 0 ? "+" : "−"}{fmt(Math.abs(totalGain))}
                  </p>
                  <p className="kpi-sub mt-1" style={{ color: totalGain >= 0 ? "var(--color-income)" : "var(--color-savings)" }}>({totalGainPct.toFixed(1)}%)</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 rounded-full border-t-2 border-r-2" style={{ borderColor: "var(--primary)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="glass-card flex flex-col p-4 w-full h-[320px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[14px] font-semibold text-foreground">{t("By Category", "Por Categoría")}</h3>
              </div>
              <div className="flex-1 w-full min-h-0 relative">
                {investmentBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={investmentBarData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip content={<CustomTooltip formatter={fmt} />} cursor={{ fill: "transparent" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                        {investmentBarData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[12px] text-muted-foreground/60">{t("No data", "Sin datos")}</span>
                  </div>
                )}
              </div>
            </Card>

            <Card className="glass-card flex flex-col p-4 w-full h-[320px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[14px] font-semibold text-foreground">{t("Distribution", "Distribución")}</h3>
              </div>
              <div className="flex-1 w-full min-h-0 relative">
                {distChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={2} dataKey="value" nameKey="name" stroke="none" style={{ outline: "none" }}>
                        {distChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} style={{ outline: "none" }} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip formatter={fmt} />} cursor={{ fill: "transparent" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[12px] text-muted-foreground/60">{t("No data", "Sin datos")}</span>
                  </div>
                )}
              </div>
            </Card>

            <Card className="glass-card flex flex-col p-4 w-full h-[320px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[14px] font-semibold text-foreground truncate mr-2">{t("PNL Evolution", "Evolución PNL")}</h3>
                <Select value={pnlPeriod} onValueChange={(v: "all" | "year" | "month" | "week") => setPnlPeriod(v)}>
                  <SelectTrigger className="w-[110px] h-8 bg-card/50 backdrop-blur-md border-[rgba(255,255,255,0.06)] text-[#F0F5F1] text-[11px] focus:ring-[#C8FF00] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-dropdown">
                    <SelectItem value="all" className="text-[12px]">{t("All time", "Todo el tiempo")}</SelectItem>
                    <SelectItem value="year" className="text-[12px]">{t("Year", "1 Año")}</SelectItem>
                    <SelectItem value="month" className="text-[12px]">{t("Month", "1 Mes")}</SelectItem>
                    <SelectItem value="week" className="text-[12px]">{t("Week", "1 Sem.")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 w-full min-h-0 relative">
                {pnlChartData.length > 0 && pnlTypes.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="85%">
                      <LineChart data={pnlChartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                        <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis
                          stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} width={60} domain={["auto", "auto"]}
                          tickFormatter={(v: number) => {
                            const sym = globalCurrency === "EUR" ? "€" : globalCurrency === "GBP" ? "£" : "$";
                            const abs = Math.abs(v);
                            const formatted = abs >= 10000 ? `${(abs / 1000).toFixed(0)}k` : abs.toLocaleString("de-DE", { maximumFractionDigits: 0 });
                            const sign = v < 0 ? "−" : "";
                            return globalCurrency === "EUR" ? `${sign}${formatted} ${sym}` : `${sign}${sym}${formatted}`;
                          }}
                        />
                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                        <Tooltip content={<PNLTooltip fmtFn={fmt} />} />
                        <Line type="monotone" dataKey="pnl" name={t("Total PNL", "PNL Total")} stroke={"var(--accent)"} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "var(--accent)" }} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center px-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 rounded-full" style={{ height: 2, background: "var(--accent)" }} />
                        <span className="text-[10px] text-muted-foreground font-medium">{t("Daily Progression", "Progresión Diaria")}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[12px] text-muted-foreground/60">{t("No data", "Sin datos")}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Nav Pills */}
          <InvestmentNavPills
            selectedType={activePill}
            onSelect={(type) => setActivePill(type)}
            grouped={grouped}
            fmt={fmt}
          />

          {/* Table */}
          <InvestmentTable
            rows={pageRows}
            allRows={allRows}
            activeRows={activeRows}
            loading={loading}
            columns={columns}
            page={page}
            totalPages={totalPages}
            histMonth={histMonth}
            histYear={histYear}
            searchQ={searchQ}
            activePill={activePill}
            onPageChange={setPage}
            onHistMonthChange={(m) => { setHistMonth(m); setPage(0); }}
            onHistYearChange={(y) => { setHistYear(y); setPage(0); }}
            onSearchChange={(q) => { setSearchQ(q); setPage(0); }}
            onRefresh={fetchAll}
            onAdd={() => {
              if (activePill === "all") setTypePickerOpen(true);
              else openCreate(activePill as AssetType);
            }}
            onEdit={openEdit}
            onDelete={handleDelete}
            loadingRefresh={loading}
            fmt={fmt}
          />
        </>
      )}

      {/* Type Picker */}
      <TypePickerDialog
        open={typePickerOpen}
        onOpenChange={setTypePickerOpen}
        onSelect={openCreate}
      />

      {/* Add/Edit Form */}
      <InvestmentForm
        open={dialogOpen}
        onOpenChange={(open) => !open && setDialogOpen(false)}
        dialogType={dialogType}
        editRow={editRow}
        formData={formData}
        onFormDataChange={setFormData}
        saving={saving}
        canSave={canSave}
        onSave={handleSave}
      />
    </div>
  );
}
