"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { format } from "date-fns";
import { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useLang } from "@/contexts/LangContext";
import { updateTransaction, deleteTransaction } from "@/services/transactions";
import { ErrorBoundary } from "react-error-boundary";
import TabErrorFallback from "@/components/common/TabErrorFallback";
import { useTransactions } from "@/hooks/data/useTransactions";
import { useInvestments } from "@/hooks/data/useInvestments";
import { useSavings } from "@/hooks/data/useSavings";

import SummaryTab from "./SummaryTab";
import BalanceTab from "./BalanceTab";
import GoalsTab from "./GoalsTab";
import InvestmentsTab from "./InvestmentsTab";
import SavingsTab from "./SavingsTab";

/* ═══════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════ */
interface Transaction {
  id: string;
  short_id: number;
  amount: number;
  date: string;
  description: string;
  type: string;
  category: string;
}

interface EditForm {
  amount: string;
  description: string;
  category: string;
  type: string;
  date: string;
  currency: "USD" | "EUR" | "GBP";
}

interface DashboardCardsProps {
  session: Session | null;
  refreshData?: number;
  onLangToggle?: () => void;
  onSignOut?: () => void;
}



type TabValue = "resumen" | "balance" | "objetivos" | "inversion" | "ahorro";
const TAB_VALUES: TabValue[] = ["resumen", "balance", "objetivos", "inversion", "ahorro"];

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function DashboardCards({
  session,
  refreshData,
}: DashboardCardsProps) {
  const { lang } = useLang();
  // Stable client reference for realtime subscriptions only
  const supabase = useMemo(() => createClient(), []);

  const userId = session?.user?.id ?? null;

  /* ── Per-domain refresh keys (incremented by realtime + WebSocket signal) ── */
  const [txRefreshKey, setTxRefreshKey] = useState(0);
  const [invRefreshKey, setInvRefreshKey] = useState(0);
  const [savingsRefreshKey, setSavingsRefreshKey] = useState(0);
  const [budgetRefreshKey, setBudgetRefreshKey] = useState(0);

  /* ── Data hooks ──────────────────────────────────────────────────────── */
  const { transactions: txs, loading, reload: reloadTxs } = useTransactions(userId, txRefreshKey);
  const { reload: reloadInvestments } = useInvestments(userId, invRefreshKey);
  const { pots: savingsPots, reload: reloadSavings } = useSavings(userId, savingsRefreshKey);

  /* ── State ───────────────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<TabValue>("resumen");

  /* ── Swipe refs ──────────────────────────────────────────────────────── */
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const noSwipeRef = useRef(false);

  /* ── WebSocket refresh signal ────────────────────────────────────────── */
  useEffect(() => {
    if (refreshData && refreshData > 0) {
      const timer = setTimeout(() => {
        setTxRefreshKey((k) => k + 1);
        setInvRefreshKey((k) => k + 1);
        setSavingsRefreshKey((k) => k + 1);
        setBudgetRefreshKey((k) => k + 1);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [refreshData]);

  /* ── Realtime: transactions ──────────────────────────────────────────── */
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`tx-realtime-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => reloadTxs()
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") reloadTxs();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, supabase, reloadTxs]);

  /* ── Realtime: investment tables (for ResumenTab KPIs) ──────────────── */
  useEffect(() => {
    if (!session) return;
    const invTables = ["inv_stocks", "inv_crypto", "inv_etfs", "inv_funds", "inv_crowdlending", "inv_realestate", "inv_commodities", "inv_forex"];
    const channel = supabase.channel(`inv-realtime-${session.user.id}`);
    for (const tbl of invTables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: tbl, filter: `user_id=eq.${session.user.id}` },
        () => { reloadInvestments(); setInvRefreshKey((k) => k + 1); }
      );
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, supabase, reloadInvestments]);

  /* ── Realtime: savings pots ─────────────────────────────────────────── */
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`savings-realtime-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "savings_pots", filter: `user_id=eq.${session.user.id}` },
        () => reloadSavings()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, supabase, reloadSavings]);

  /* ── Realtime: budgets ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`budget-realtime-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budgets",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => setBudgetRefreshKey((k) => k + 1)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, supabase]);

  /* ── Export CSV ──────────────────────────────────────────────────────── */
  const handleExportCSV = useCallback(() => {
    if (!txs.length) return;
    const headers = ["Date", "Description", "Category", "Type", "Amount"];
    const rows = txs.map((tx) => [
      tx.date,
      tx.description || "",
      tx.category || "",
      tx.type || "",
      tx.amount.toString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", `transactions_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [txs]);

  /* ── Delete transaction ──────────────────────────────────────────────── */
  const handleDelete = useCallback(
    async (tx: Transaction) => {
      if (
        !confirm(
          lang === "es"
            ? `¿Eliminar "${tx.description || tx.category}"?`
            : `Delete "${tx.description || tx.category}"?`
        )
      )
        return;
      await deleteTransaction(tx.id);
      setTxRefreshKey((k) => k + 1);
    },
    [lang]
  );

  /* ── Save edit ───────────────────────────────────────────────────────── */
  const handleSaveEdit = useCallback(
    async (editTx: Transaction, form: EditForm) => {
      await updateTransaction(editTx.id, {
        amount: Math.abs(parseFloat(form.amount) || 0),
        description: form.description || "-",
        category: form.category,
        type: form.type,
        date: form.date,
        currency: form.currency,
      });
    },
    []
  );

  /* ── Swipe gesture handlers (with table-scroll detection) ────────────── */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    noSwipeRef.current = false;

    // Block swipe if the touch originates inside an open dialog/modal
    const target = e.target as HTMLElement;
    if (target.closest('dialog, [role="dialog"], [data-radix-dialog-content]')) {
      noSwipeRef.current = true;
      return;
    }

    // Block if the touched element is inside a chart (recharts), table, svg or canvas
    if (target.closest('.recharts-wrapper, .recharts-responsive-container, table, [role="grid"], svg, canvas')) {
      noSwipeRef.current = true;
      return;
    }

    // Block if the touched element is inside a scrollable container
    let el: HTMLElement | null = target;
    while (el) {
      const style = window.getComputedStyle(el);
      const ox = style.overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth) {
        noSwipeRef.current = true;
        break;
      }
      el = el.parentElement;
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (noSwipeRef.current) return;
      // Block if any Radix dialog overlay or native dialog is open
      if (document.querySelector("[data-radix-dialog-overlay], dialog[open]")) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      if (Math.abs(deltaX) < 60 || Math.abs(deltaY) > Math.abs(deltaX) * 0.8) return;
      const currentIdx = TAB_VALUES.indexOf(activeTab);
      if (deltaX < 0 && currentIdx < TAB_VALUES.length - 1) {
        setActiveTab(TAB_VALUES[currentIdx + 1]);
      } else if (deltaX > 0 && currentIdx > 0) {
        setActiveTab(TAB_VALUES[currentIdx - 1]);
      }
    },
    [activeTab]
  );

  /* ── Tab labels ──────────────────────────────────────────────────────── */
  const tabs: { value: TabValue; en: string; es: string }[] = [
    { value: "resumen", en: "Summary", es: "Resumen" },
    { value: "balance", en: "Balance", es: "Balance" },
    { value: "objetivos", en: "Goals", es: "Objetivos" },
    { value: "inversion", en: "Investment", es: "Inversión" },
    { value: "ahorro", en: "Savings", es: "Ahorro" },
  ];

  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      <div className="pt-2" />


      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className="flex flex-col"
      >
        {/* Mobile: button carousel */}
        <div
          className="block md:!hidden tab-nav-bar py-2"
          style={{ background: "var(--tab-nav-bg-mobile)" }}
        >
          <div className="flex px-4 gap-2 items-center min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`tab-pill snap-center${activeTab === tab.value ? " active" : ""}`}
              >
                {lang === "es" ? tab.es : tab.en}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: pill buttons */}
        <div
          className="hidden md:!block tab-nav-bar"
        >
          <div className="flex px-4 gap-1 h-10 items-center">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`tab-btn${activeTab === tab.value ? " active" : ""}`}
              >
                {lang === "es" ? tab.es : tab.en}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Panels */}
        <div
          className="px-4 pt-4 pb-32"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <TabsContent value="resumen" className="mt-0">
            <ErrorBoundary
              FallbackComponent={({ error, resetErrorBoundary }) => (
                <TabErrorFallback tabName="resumen" error={error} resetErrorBoundary={resetErrorBoundary} />
              )}
            >
              <SummaryTab transactions={txs} savingsPots={savingsPots} session={session} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="balance" className="mt-0">
            <ErrorBoundary
              FallbackComponent={({ error, resetErrorBoundary }) => (
                <TabErrorFallback tabName="balance" error={error} resetErrorBoundary={resetErrorBoundary} />
              )}
            >
              <BalanceTab
                transactions={txs}
                loading={loading}
                session={session}
                onDelete={handleDelete}
                onEdit={() => { }}
                onSaveEdit={handleSaveEdit}
                onExportCSV={handleExportCSV}
                onRefresh={() => setTxRefreshKey((k) => k + 1)}
              />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="objetivos" className="mt-0">
            <ErrorBoundary
              FallbackComponent={({ error, resetErrorBoundary }) => (
                <TabErrorFallback tabName="objetivos" error={error} resetErrorBoundary={resetErrorBoundary} />
              )}
            >
              <GoalsTab
                transactions={txs}
                session={session}
                refreshKey={budgetRefreshKey}
                savingsPots={savingsPots}
                onSavingsPotsChange={() => {
                  setSavingsRefreshKey((k) => k + 1);
                  setTxRefreshKey((k) => k + 1);
                }}
              />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="inversion" className="mt-0">
            <ErrorBoundary
              FallbackComponent={({ error, resetErrorBoundary }) => (
                <TabErrorFallback tabName="inversion" error={error} resetErrorBoundary={resetErrorBoundary} />
              )}
            >
              <InvestmentsTab session={session} refreshKey={invRefreshKey} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="ahorro" className="mt-0">
            <ErrorBoundary
              FallbackComponent={({ error, resetErrorBoundary }) => (
                <TabErrorFallback tabName="ahorro" error={error} resetErrorBoundary={resetErrorBoundary} />
              )}
            >
              <SavingsTab transactions={txs} savingsPots={savingsPots} />
            </ErrorBoundary>
          </TabsContent>
        </div>
      </Tabs >
    </div >
  );
}
