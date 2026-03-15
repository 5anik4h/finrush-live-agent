"use client";

import { useLang } from "@/contexts/LangContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, fmtCurrency, type Currency } from "@/lib/currency";
import { getFormattedDateForInput, parseDateFromInput } from "@/lib/date";
import type { SavingsPot } from "@/types";

// Design tokens
const P = {
  lime: "var(--color-income)",
  red: "var(--color-expense)",
  textPri: "var(--foreground)",
  textSec: "var(--muted-foreground)",
};

export interface ContributionForm {
  amount: string;
  type: "deposit" | "withdrawal";
  date: string;
  note: string;
  currency: string;
}

interface SavingsDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "deposit" | "withdraw";
  pot: SavingsPot | null;
  form: ContributionForm;
  onFormChange: (f: ContributionForm) => void;
  saving: boolean;
  onSubmit: () => void;
}

export default function SavingsDepositModal({
  open,
  onOpenChange,
  mode,
  pot,
  form,
  onFormChange,
  saving,
  onSubmit,
}: SavingsDepositModalProps) {
  const { lang } = useLang();
  const { currency: globalCurrency, fmt } = useCurrency();
  const t = (en: string, es: string) => (lang === "es" ? es : en);

  const isDeposit = mode === "deposit";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="glass-dialog max-w-sm shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold flex items-center gap-2" style={{ color: P.textPri }}>
            {isDeposit ? (
              <ArrowDownCircle className="w-5 h-5" style={{ color: P.lime }} />
            ) : (
              <ArrowUpCircle className="w-5 h-5" style={{ color: P.red }} />
            )}
            {isDeposit
              ? t("Deposit to", "Depositar en")
              : t("Withdraw from", "Retirar de")}{" "}
            {pot?.name}
          </DialogTitle>
        </DialogHeader>

        {!isDeposit && pot && (
          <p className="text-[11px]" style={{ color: P.textSec }}>
            {t("Available", "Disponible")}:{" "}
            <span className="font-bold" style={{ color: P.lime }}>
              {pot.currency === globalCurrency ? (
                fmtCurrency(Number(pot.current_balance), pot.currency as Currency)
              ) : (
                fmt(Number(pot.current_balance_usd ?? (Number(pot.current_balance) / (pot.rate_at_entry || 1))))
              )}
            </span>
          </p>
        )}

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: P.textSec }}>
                {t("Amount", "Cantidad")}
              </label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                autoFocus
                value={form.amount}
                onChange={(e) => onFormChange({ ...form, amount: e.target.value })}
                className="dialog-input w-full text-[15px] font-bold h-10"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: P.textSec }}>
                {t("Currency", "Divisa")}
              </label>
              <Select
                value={form.currency}
                onValueChange={(v) => onFormChange({ ...form, currency: v })}
              >
                <SelectTrigger className="h-10 bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.12)] text-[#F0F5F1] text-[12px] focus:ring-[#C8FF00]">
                  <SelectValue placeholder={t("Select", "Seleccionar")} />
                </SelectTrigger>
                <SelectContent className="bg-background border-[rgba(255,255,255,0.12)] text-[#F0F5F1]">
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.value} {c.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: P.textSec }}>
              {t("Note (optional)", "Nota (opcional)")}
            </label>
            <Input
              value={form.note}
              onChange={(e) => onFormChange({ ...form, note: e.target.value })}
              maxLength={100}
              className="dialog-input w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: P.textSec }}>
              {t("Date", "Fecha")}
            </label>
            <Input
              type="date"
              value={getFormattedDateForInput(form.date)}
              onChange={(e) => onFormChange({ ...form, date: parseDateFromInput(form.date, e.target.value) })}
              className="dialog-input-date w-full"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-9 bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.12)] text-[rgba(240,245,241,0.60)]"
          >
            {t("Cancel", "Cancelar")}
          </Button>
          {isDeposit ? (
            <Button
              size="sm"
              disabled={saving || !form.amount}
              onClick={onSubmit}
              className="flex-1 h-9 font-bold text-[#0A1A0F] disabled:opacity-50"
              style={{ background: P.lime }}
            >
              {saving ? t("Depositing…", "Depositando…") : t("Deposit", "Depositar")}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={saving || !form.amount}
              onClick={onSubmit}
              className="flex-1 h-9 font-bold text-white disabled:opacity-50"
              style={{ background: P.red }}
            >
              {saving ? t("Withdrawing…", "Retirando…") : t("Withdraw", "Retirar")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
