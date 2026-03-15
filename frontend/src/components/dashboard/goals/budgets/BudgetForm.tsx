"use client";

import { useLang } from "@/contexts/LangContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { Repeat } from "lucide-react";
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

// Design tokens
const P = {
  textPri: "var(--foreground)",
  textSec: "var(--muted-foreground)",
  textDim: "var(--muted-foreground)",
};

export interface Budget {
  id: string;
  user_id: string;
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

export interface BudgetForm {
  name: string;
  type: string;
  categories: string[];
  amount: string;
  date_from: string;
  date_to: string;
  recurrence: string;
  currency: string;
}

interface BudgetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editBudget: Budget | null;
  form: BudgetForm;
  onFormChange: (f: BudgetForm) => void;
  saving: boolean;
  onSave: () => void;
}

export default function BudgetFormDialog({
  open,
  onOpenChange,
  editBudget,
  form,
  onFormChange,
  saving,
  onSave,
}: BudgetFormProps) {
  const { lang } = useLang();
  const { currency } = useCurrency();
  const t = (en: string, es: string) => (lang === "es" ? es : en);

  const toggleCategory = (value: string) => {
    onFormChange({
      ...form,
      categories: form.categories.includes(value)
        ? form.categories.filter((c) => c !== value)
        : form.categories.length < 3
          ? [...form.categories, value]
          : form.categories, // max 3 categories
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="glass-dialog max-w-md shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold" style={{ color: P.textPri }}>
            {editBudget
              ? t("Edit Budget", "Editar Presupuesto")
              : t("New Budget", "Nuevo Presupuesto")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: P.textSec }}>
              {t("Budget Name", "Nombre")}
            </label>
            <Input
              placeholder={t("e.g. Food & Home", "ej. Alimentación y Hogar")}
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              maxLength={40}
              className="dialog-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: P.textSec }}>
                {t("From (optional)", "Desde (opcional)")}
              </label>
              <Input
                type="date"
                value={form.date_from}
                onChange={(e) => onFormChange({ ...form, date_from: e.target.value })}
                className="dialog-input-date w-full"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: P.textSec }}>
                {t("To (optional)", "Hasta (opcional)")}
              </label>
              <Input
                type="date"
                value={form.date_to}
                onChange={(e) => onFormChange({ ...form, date_to: e.target.value })}
                className="dialog-input-date w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-2" style={{ color: P.textSec }}>
              {t("Categories (max 3)", "Categorías (máx. 3)")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((cat) => {
                const active = form.categories.includes(cat.value);
                const atMax = form.categories.length >= 3 && !active;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => toggleCategory(cat.value)}
                    disabled={atMax}
                    className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full transition-colors border disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      background: active ? "rgba(179,136,255,0.12)" : "rgba(255,255,255,0.04)",
                      borderColor: active ? "rgba(179,136,255,0.4)" : "rgba(255,255,255,0.12)",
                      color: active ? "#B388FF" : P.textDim,
                    }}
                  >
                    {(() => {
                      const iconColor = active ? "#B388FF" : P.textDim;
                      const CatIcon = getCategoryIcon(cat.value);
                      return <CatIcon className="w-3 h-3 shrink-0" style={{ color: iconColor }} />;
                    })()}
                    {lang === "es" ? cat.label_es : cat.label_en}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: P.textSec }}>
                {t("Limit", "Límite")}
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => onFormChange({ ...form, amount: e.target.value })}
                className="dialog-input w-full"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: P.textSec }}>
                {t("Currency", "Divisa")}
              </label>
              <Select value={form.currency || currency} onValueChange={(v) => onFormChange({ ...form, currency: v })}>
                <SelectTrigger className="h-9 bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.12)] text-[#F0F5F1] text-[12px] focus:ring-[#C8FF00]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-[rgba(255,255,255,0.12)] text-[#F0F5F1]">
                  <SelectItem value="USD">USD $</SelectItem>
                  <SelectItem value="EUR">EUR €</SelectItem>
                  <SelectItem value="GBP">GBP £</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: P.textSec }}>
              <Repeat className="w-3 h-3" />
              {t("Recurrence", "Repetir")}
            </label>
            <Select value={form.recurrence} onValueChange={(v) => onFormChange({ ...form, recurrence: v })}>
              <SelectTrigger className="h-9 bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.12)] text-[#F0F5F1] text-[12px] focus:ring-[#C8FF00]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-[rgba(255,255,255,0.12)] text-[#F0F5F1]">
                <SelectItem value="daily">{t("Daily", "Diario")}</SelectItem>
                <SelectItem value="weekly">{t("Weekly", "Semanal")}</SelectItem>
                <SelectItem value="monthly">{t("Monthly (default)", "Mensual (por defecto)")}</SelectItem>
                <SelectItem value="yearly">{t("Yearly", "Anual")}</SelectItem>
              </SelectContent>
            </Select>
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
          <Button
            size="sm"
            disabled={saving || !form.name || !form.amount}
            onClick={onSave}
            className="flex-1 btn-primary disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #FFB74D, #FFAA33)" }}
          >
            {saving ? t("Saving…", "Guardando…") : t("Save", "Guardar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
