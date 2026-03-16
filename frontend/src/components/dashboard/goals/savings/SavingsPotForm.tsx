"use client";

import { useLang } from "@/contexts/LangContext";
import { useCurrency } from "@/contexts/CurrencyContext";
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
};

export interface SavingsPot {
  id: string;
  name: string;
  current_balance: number;
  target_amount: number | null;
  categories?: string[];
  currency?: string;
}

export interface SavingsPotForm {
  name: string;
  target_amount: string;
  categories: string[];
  currency: string;
}

interface SavingsPotFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPot: SavingsPot | null;
  form: SavingsPotForm;
  onFormChange: (f: SavingsPotForm) => void;
  saving: boolean;
  onSave: () => void;
}

export default function SavingsPotFormDialog({
  open,
  onOpenChange,
  editPot,
  form,
  onFormChange,
  saving,
  onSave,
}: SavingsPotFormProps) {
  const { lang } = useLang();
  const { currency } = useCurrency();
  const t = (en: string, es: string) => (lang === "es" ? es : en);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="glass-dialog max-w-md shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold" style={{ color: P.textPri }}>
            {editPot
              ? t("Edit Savings Pot", "Editar Hucha")
              : t("New Savings Pot", "Nueva Hucha")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: P.textSec }}>
              {t("Name", "Nombre")}
            </label>
            <Input
              placeholder={t("e.g. Emergency Fund", "ej. Fondo de Emergencia")}
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              maxLength={40}
              className="dialog-input w-full"
            />
          </div>

          {/* Target amount and currency */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: P.textSec }}>
                {t("Target", "Objetivo")} <span style={{ color: "#FF6B6B" }}>*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={t("Required", "Requerido")}
                value={form.target_amount}
                onChange={(e) => onFormChange({ ...form, target_amount: e.target.value })}
                className="dialog-input w-full"
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
            disabled={saving || !form.name || !form.target_amount}
            onClick={onSave}
            className="flex-1 btn-primary disabled:opacity-50"
          >
            {saving ? t("Saving…", "Guardando…") : t("Save", "Guardar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
