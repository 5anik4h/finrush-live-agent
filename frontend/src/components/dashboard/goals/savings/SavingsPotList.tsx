"use client";

import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  PiggyBank,
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  Trash2,
  CalendarDays,
  Filter,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { type Currency, fmtCurrency } from "@/lib/currency";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLang } from "@/contexts/LangContext";
import { es as esLocale } from "date-fns/locale";
import { useState } from "react";
import { useExclusiveDropdown } from "@/hooks/useExclusiveDropdown";

// Design tokens
const P = {
  lime: "var(--color-income)",
  red: "var(--color-expense)",
  amber: "var(--color-savings)",
  textPri: "var(--foreground)",
  textSec: "var(--muted-foreground)",
  textDim: "var(--muted-foreground)",
  border: "var(--glass-border)",
};

export interface SavingsPot {
  id: string;
  name: string;
  short_id?: number;
  current_balance: number;
  current_balance_usd?: number;
  target_amount: number | null;
  target_amount_usd?: number;
  rate_at_entry?: number;
  currency?: string;
  categories?: string[];
}

export interface SavingsContribution {
  id: string;
  amount: number;
  currency?: string;
  short_id?: number;
  note: string | null;
  date: string;
  created_at: string;
}

interface SavingsPotListProps {
  pots: SavingsPot[];
  potHistory: Record<string, SavingsContribution[]>;
  potHistoryPage: Record<string, number>;
  onSetPotHistoryPage: (potId: string, page: number) => void;
  onEdit: (pot: SavingsPot) => void;
  onDelete: (pot: SavingsPot) => void;
  onDeposit: (pot: SavingsPot) => void;
  onWithdraw: (pot: SavingsPot) => void;
  onCreateNew: () => void;
}

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export default function SavingsPotList({
  pots,
  potHistory,
  potHistoryPage,
  onSetPotHistoryPage,
  onEdit,
  onDelete,
  onDeposit,
  onWithdraw,
  onCreateNew,
}: SavingsPotListProps) {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const { fmt } = useCurrency();
  const { openId, setOpen } = useExclusiveDropdown();

  const [potHistMonth, setPotHistMonth] = useState<string>("all");
  const [potHistYear, setPotHistYear] = useState<string>(new Date().getFullYear().toString());

  if (pots.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center gap-4 py-16 rounded-2xl"
        style={{ border: `1px dashed ${P.border}` }}
      >
        <PiggyBank className="w-10 h-10 opacity-30" style={{ color: P.amber }} />
        <div className="text-center">
          <p className="text-[13px]" style={{ color: P.textDim }}>
            {t("No savings pots yet", "Aún no tienes huchas")}
          </p>
          <p className="text-[11px] mt-1" style={{ color: P.textDim }}>
            {t(
              "Create your first pot to start saving towards your goals!",
              "¡Crea tu primera hucha para empezar a ahorrar hacia tus metas!"
            )}
          </p>
        </div>
        <Button
          onClick={onCreateNew}
          size="sm"
          className="mt-1 btn-primary"
        >
          <PiggyBank className="w-3.5 h-3.5 mr-1.5" />
          {t("Create My First Pot", "Crear Mi Primera Hucha")}
        </Button>
      </motion.div>
    );
  }

  // Build combined history for all pots
  const allPotHistory = pots
    .flatMap((pot) =>
      (potHistory[pot.id] || []).map((h) => ({ ...h, pot }))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      {/* Pot cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AnimatePresence>
          {pots
            .sort((a, b) => Number(b.current_balance_usd ?? b.current_balance) - Number(a.current_balance_usd ?? a.current_balance))
            .map((pot, i) => {
              const balance = Number(pot.current_balance_usd ?? pot.current_balance ?? 0);
              const target = pot.target_amount_usd != null ? Number(pot.target_amount_usd) : (pot.target_amount ? Number(pot.target_amount) : null);
              const pct = target && target > 0 ? Math.min(100, (balance / target) * 100) : null;

              return (
                <motion.div
                  key={pot.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                >
                  <Card className="glass-card">
                    <CardHeader className="pb-2 px-4 pt-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <CardTitle className="type-title">
                            {pot.name}
                          </CardTitle>
                          {target ? (
                            <p className="text-[10px] mt-0.5" style={{ color: P.textDim }}>
                              {t("Goal", "Meta")}: {fmt(target)}
                              {pot.short_id && ` - id #${pot.short_id}`}
                            </p>
                          ) : (
                            <p className="text-[10px] mt-0.5" style={{ color: P.textDim }}>
                              {t("No target set", "Sin objetivo fijo")}
                              {pot.short_id && ` - id #${pot.short_id}`}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onEdit(pot)}
                            className="btn-icon-sm hover:bg-white/10"
                          >
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => onDelete(pot)}
                            className="btn-icon-sm hover:bg-[rgba(255,170,51,0.1)]"
                          >
                            <Trash2 className="w-3.5 h-3.5" style={{ color: P.amber }} />
                          </button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="px-4 pb-4 pt-0 space-y-2.5">
                      {/* Action buttons */}
                      <div className="flex items-center justify-end">
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDeposit(pot)}
                            className="h-7 px-2.5 text-[11px] font-bold"
                            style={{
                              borderColor: "rgba(200,255,0,0.35)",
                              color: P.lime,
                              background: "rgba(200,255,0,0.04)",
                            }}
                          >
                            <ArrowDownCircle className="w-3 h-3 mr-1" />
                            {t("Deposit", "Depositar")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onWithdraw(pot)}
                            className="h-7 px-2.5 text-[11px] font-bold bg-card/50 border-border text-[#a1a1aa] hover:bg-white/5"
                          >
                            <ArrowUpCircle className="w-3 h-3 mr-1" />
                            {t("Withdraw", "Retirar")}
                          </Button>
                        </div>
                      </div>

                      {/* Progress bar (only if target exists) */}
                      {pct !== null ? (
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[11px]" style={{ color: P.textSec }}>
                              {fmt(balance)} / {fmt(target ?? 0)}
                            </span>
                            <span
                              className="text-[11px] font-bold"
                              style={{ color: P.lime }}
                            >
                              {Math.min(pct, 100).toFixed(0)}%
                            </span>
                          </div>
                          <div
                            className="w-full h-2 rounded-full overflow-hidden"
                            style={{ background: "rgba(255,255,255,0.08)" }}
                          >
                            <motion.div
                              className="h-full rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(pct, 100)}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                              style={{
                                background:
                                  pct >= 100
                                    ? `linear-gradient(90deg, var(--color-income) 0%, #8BC34A 100%)`
                                    : pct > 80
                                      ? `linear-gradient(90deg, var(--color-savings) 0%, var(--color-income) 100%)`
                                      : `linear-gradient(90deg, #FFCC66, var(--color-savings))`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="h-[30px]" />
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* Contribution History (external, below cards) */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-white/5" />
          <h4 className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: P.textDim }}>
            {t("History", "Historial")}
          </h4>
          <div className="h-px flex-1 bg-white/5" />
        </div>

        {/* Savings Pot History Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <DropdownMenu open={openId === "potMonthFilter"} onOpenChange={(isOpen) => setOpen(isOpen ? "potMonthFilter" : null)}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2.5 bg-card/30 border-border text-[#a1a1aa] hover:bg-white/5 text-[12px]">
                <CalendarDays className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                {potHistMonth === "all"
                  ? t("Month", "Mes")
                  : capitalize(format(new Date(2000, parseInt(potHistMonth), 1), "MMMM", { locale: lang === "es" ? esLocale : undefined }))}
                <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-background border-border text-[#F0F5F1] max-h-[200px] overflow-y-auto">
              <DropdownMenuItem
                onClick={() => { setPotHistMonth("all"); onSetPotHistoryPage("__global__", 0); }}
                className="dropdown-item-focus text-[12px] py-1.5"
              >
                {t("All", "Todos")}
              </DropdownMenuItem>
              {Array.from({ length: 12 }).map((_, i) => (
                <DropdownMenuItem
                  key={i}
                  onClick={() => { setPotHistMonth(String(i)); onSetPotHistoryPage("__global__", 0); }}
                  className="dropdown-item-focus text-[12px] py-1.5"
                >
                  {capitalize(format(new Date(2000, i, 1), "MMMM", { locale: lang === "es" ? esLocale : undefined }))}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu open={openId === "potYearFilter"} onOpenChange={(isOpen) => setOpen(isOpen ? "potYearFilter" : null)}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2.5 bg-card/30 border-border text-[#a1a1aa] hover:bg-white/5 text-[12px]">
                <Filter className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                {potHistYear}
                <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-background border-border text-[#F0F5F1]">
              {[
                ...new Set([
                  new Date().getFullYear(),
                  ...allPotHistory.map((h) => new Date(h.date).getFullYear()),
                ]),
              ]
                .sort((a, b) => b - a)
                .map((y) => (
                  <DropdownMenuItem
                    key={y}
                    onClick={() => { setPotHistYear(y.toString()); onSetPotHistoryPage("__global__", 0); }}
                    className="dropdown-item-focus text-[12px] py-1.5"
                  >
                    {y}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

        </div>

        {allPotHistory.length === 0 ? (
          <div
            className="flex items-center justify-center py-8 rounded-2xl text-[12px]"
            style={{ border: `1px dashed ${P.border}`, color: P.textDim }}
          >
            {t("No contributions yet", "Sin aportaciones aún")}
          </div>
        ) : (() => {
          const filteredPotHistory = allPotHistory.filter((h) => {
            const d = new Date(h.date);
            if (potHistMonth !== "all" && d.getMonth() !== parseInt(potHistMonth)) return false;
            if (d.getFullYear() !== parseInt(potHistYear)) return false;
            return true;
          });
          const totalPotHistPages = Math.ceil(filteredPotHistory.length / 10);
          const potHistPage = potHistoryPage["__global__"] || 0;
          const pageItems = filteredPotHistory.slice(potHistPage * 10, (potHistPage + 1) * 10);

          if (filteredPotHistory.length === 0) {
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
              {pageItems.map((h, idx) => (
                <div
                  key={`${h.id}-${idx}`}
                  className="flex items-center justify-between px-4 py-3 rounded-xl group hover:bg-white/[0.04] transition-colors"
                  style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}` }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: h.amount >= 0 ? P.lime : P.red }}
                      />
                      <p className="text-[12px] font-semibold truncate" style={{ color: P.textPri }}>
                        {h.pot.name}
                        {h.short_id && ` - id #${h.short_id}`}
                      </p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 font-bold" style={{ color: P.textDim }}>
                        {h.amount >= 0 ? t("Deposit", "Depósito") : t("Withdrawal", "Retiro")}
                      </span>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: P.textDim }}>
                      {format(new Date(h.date), "MMM d, yyyy")} {h.note ? `· ${h.note}` : ""}
                    </p>
                  </div>
                  <span
                    className="text-[12px] font-bold shrink-0 ml-4"
                    style={{ color: h.amount >= 0 ? P.lime : P.red }}
                  >
                    {h.amount >= 0 ? "+" : ""}{fmtCurrency(Math.abs(h.amount), (h.currency || "USD") as Currency)}
                  </span>
                </div>
              ))}
              {totalPotHistPages > 1 && (
                <div className="flex items-center justify-between px-2 pt-2">
                  <button
                    onClick={() => onSetPotHistoryPage("__global__", Math.max(0, potHistPage - 1))}
                    disabled={potHistPage === 0}
                    className="text-[11px] px-2 py-1 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10 transition-colors"
                  >
                    {t("Prev", "Ant.")}
                  </button>
                  <span className="text-[11px]" style={{ color: P.textDim }}>
                    {potHistPage + 1} / {totalPotHistPages}
                  </span>
                  <button
                    onClick={() => onSetPotHistoryPage("__global__", Math.min(totalPotHistPages - 1, potHistPage + 1))}
                    disabled={potHistPage >= totalPotHistPages - 1}
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
