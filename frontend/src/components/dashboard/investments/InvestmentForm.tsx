"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ASSET_TYPE_ICON_META } from "@/lib/categoryIcons";
import { getAssetTypeLabel, AssetType, GROUP_B_ASSET_TYPES } from "@/lib/categories";
import { useLang } from "@/contexts/LangContext";
import { format } from "date-fns";
import { type InvRow } from "./InvestmentTable";

/* ═══════════════════════════════════════════════
   EXPORTED TYPES
   ═══════════════════════════════════════════════ */

export interface FormField {
  key: string;
  label_en: string;
  label_es: string;
  type: "text" | "number" | "date" | "select" | "toggle";
  placeholder?: string;
  required?: boolean;
  requiredWhen?: (data: Record<string, unknown>) => boolean;
  disabledWhen?: (data: Record<string, unknown>) => boolean;
  options?: { value: string; label_en: string; label_es: string }[];
  maxLength?: number;
  step?: string;
  uppercase?: boolean;
  half?: boolean;
  condition?: (data: Record<string, unknown>) => boolean;
  readOnlyOnCreate?: boolean;
}

/* ═══════════════════════════════════════════════
   FIELDS THAT NEED CURRENCY CONVERSION BY TYPE
   ═══════════════════════════════════════════════ */

export const MONETARY_FIELDS_BY_TYPE: Record<string, string[]> = {
  stock:        ["buy_price", "current_price"],
  commodity:    ["buy_price", "current_price"],
  crypto:       ["buy_price", "current_price"],
  etf:          ["buy_price", "current_price"],
  fund:         ["buy_price", "current_value"],
  fixedincome:  ["quantity", "accumulated_interest"],
  crowdlending: ["quantity", "accumulated_interest"],
  account:      ["quantity", "accumulated_interest"],
  realestate:   ["estimated_value", "pending_mortgage", "purchase_price", "monthly_rent"],
  forex:        ["quantity"],
};

/* ═══════════════════════════════════════════════
   SHARED OPTION LISTS
   ═══════════════════════════════════════════════ */

const FREQUENCY_OPTIONS = [
  { value: "daily",     label_en: "Daily",     label_es: "Diaria" },
  { value: "weekly",    label_en: "Weekly",    label_es: "Semanal" },
  { value: "monthly",   label_en: "Monthly",   label_es: "Mensual" },
  { value: "quarterly", label_en: "Quarterly", label_es: "Trimestral" },
  { value: "annual",    label_en: "Annual",    label_es: "Anual" },
];

/* ═══════════════════════════════════════════════
   GROUP A UNIFIED FIELDS (stock, crypto, etf, commodity)
   Layout:
     [TICKER          ] [NOMBRE           ]
     [CANTIDAD        ] [VALOR TOTAL      ]
     [P. COMPRA       ] [ACTUAL           ]
     [DIVISA (select) ] [TOGGLE manual    ]
     [FECHA (full)    ]
   ═══════════════════════════════════════════════ */

const GROUP_A_FIELDS: FormField[] = [
  { key: "ticker",            label_en: "Ticker",       label_es: "Ticker",      type: "text",   required: true,  maxLength: 10, uppercase: true, half: true },
  { key: "name",              label_en: "Name",         label_es: "Nombre",      type: "text",   maxLength: 60,                   half: true },
  { key: "quantity",          label_en: "Quantity",     label_es: "Cantidad",    type: "number", step: "any",                     half: true },
  { key: "total_amount",      label_en: "Total Value",  label_es: "Valor Total", type: "number", step: "any",                     half: true },
  { key: "buy_price",         label_en: "Buy Price",    label_es: "P. Compra",   type: "number", step: "any",     half: true,     placeholder: "0" },
  { key: "current_price",     label_en: "Current",      label_es: "Actual",      type: "number", step: "any",     half: true,
    placeholder: "Auto",
    disabledWhen: (data) => !data.skip_price_update,
    requiredWhen: (data) => !!data.skip_price_update,
  },
  // currency is rendered as a standalone half-width row (left side) before skip_price_update
  { key: "skip_price_update", label_en: "Manual price (no auto-update)", label_es: "Precio manual (sin actualización automática)", type: "toggle" },
  { key: "date",              label_en: "Date",         label_es: "Fecha",       type: "date",   required: true },
];

/* ═══════════════════════════════════════════════
   GROUP B UNIFIED FIELDS (fixedincome, account, crowdlending)
   Layout:
     [PLATAFORMA O ENTIDAD (full)  ]
     [CANTIDAD        ] [DIVISA    ]
     [APY%            ] [FRECUENCIA]
     [REINVERTIR (toggle)          ]
     [INTERESES ACUM. (full)       ]
     [FECHA INICIO    ] [FECHA FIN ]
   ═══════════════════════════════════════════════ */

const GROUP_B_FIELDS: FormField[] = [
  { key: "name",                 label_en: "Platform / Entity",  label_es: "Plataforma / Entidad",  type: "text",   required: true, maxLength: 60 },
  { key: "quantity",             label_en: "Amount",             label_es: "Cantidad",              type: "number", required: true, step: "any",   half: true },
  // currency rendered separately
  { key: "apy",                  label_en: "APY %",              label_es: "APY %",                 type: "number", required: true, step: "0.01",  half: true },
  { key: "frequency",            label_en: "Frequency",          label_es: "Frecuencia",            type: "select", required: true, half: true, options: FREQUENCY_OPTIONS },
  { key: "reinvest",             label_en: "Reinvest",           label_es: "Reinvertir",            type: "toggle" },
  { key: "accumulated_interest", label_en: "Accrued Interest",   label_es: "Intereses Acumulados",  type: "number", step: "any", placeholder: "0", readOnlyOnCreate: true },
  { key: "start_date",           label_en: "Start Date",         label_es: "Fecha Inicio",          type: "date",   required: true, half: true },
  { key: "end_date",             label_en: "End Date",           label_es: "Fecha Vencimiento",     type: "date",   half: true },
];

/* ═══════════════════════════════════════════════
   EXPORTED FORM FIELDS GETTER
   ═══════════════════════════════════════════════ */

export function getFormFields(type: AssetType): FormField[] {
  switch (type) {
    // ── Group A: all tradeables use identical schema ─────────────────────────
    case "stock":
    case "crypto":
    case "etf":
    case "commodity":
      return GROUP_A_FIELDS;

    // ── Group B: all interest-bearing use identical schema ───────────────────
    case "fixedincome":
    case "account":
    case "crowdlending":
      return GROUP_B_FIELDS;

    // ── Fund ─────────────────────────────────────────────────────────────────
    // Layout:
    //   [NOMBRE DEL FONDO (full)         ]
    //   [PARTICIPACIONES ] [VALOR TOTAL  ]
    //   [P. COMPRA       ] [VALOR ACTUAL ]
    //   [DIVISA (select) ] [TER %        ]
    //   [FECHA (full)    ]
    case "fund":
      return [
        { key: "name",          label_en: "Fund Name",     label_es: "Nombre del Fondo", type: "text",   required: true, maxLength: 60 },
        { key: "quantity",      label_en: "Units",         label_es: "Participaciones",  type: "number", step: "any",    half: true },
        { key: "total_amount",  label_en: "Total Value",   label_es: "Valor Total",      type: "number", step: "any",    half: true },
        { key: "buy_price",     label_en: "Buy Price",     label_es: "P. Compra",        type: "number", step: "any",    placeholder: "Auto", half: true },
        { key: "current_value", label_en: "Current Value", label_es: "Valor Actual",     type: "number", step: "any",    placeholder: "Auto", half: true },
        // currency rendered inline after current_value (fills DIVISA slot)
        { key: "ter",           label_en: "TER %",         label_es: "TER %",            type: "number", step: "0.01",   placeholder: "0.20", half: true },
        { key: "date",          label_en: "Date",          label_es: "Fecha",            type: "date",   required: true },
      ];

    // ── Forex ─────────────────────────────────────────────────────────────────
    case "forex":
      return [
        { key: "name",     label_en: "Deposit Label",  label_es: "Etiqueta del Depósito", type: "text",   maxLength: 60 },
        { key: "quantity", label_en: "Amount",         label_es: "Cantidad",              type: "number", required: true, step: "any", half: true },
        // currency rendered separately — fills the other half
        { key: "date",     label_en: "Date",           label_es: "Fecha",                 type: "date",   required: true },
      ];

    // ── Real estate ───────────────────────────────────────────────────────────
    case "realestate":
      return [
        { key: "name",             label_en: "Property Name",  label_es: "Nombre Propiedad", type: "text",   required: true, maxLength: 60 },
        { key: "purchase_price",   label_en: "Purchase Price", label_es: "Precio Compra",    type: "number", step: "any", half: true },
        { key: "pending_mortgage", label_en: "Mortgage (Debt)", label_es: "Hipoteca (Deuda)", type: "number", step: "any", half: true },
        { key: "estimated_value",  label_en: "Est. Value",     label_es: "Valor Estimado",   type: "number", required: true, step: "any", half: true },
        { key: "monthly_rent",     label_en: "Rent / Month",   label_es: "Renta / Mes",      type: "number", step: "any", half: true },
        { key: "date",             label_en: "Date",           label_es: "Fecha",            type: "date",   required: true },
        // currency rendered separately as full-width below date
      ];

    default:
      return [];
  }
}

/* ═══════════════════════════════════════════════
   TYPES THAT USE CURRENCY INLINE (before date)
   vs FULL WIDTH (after fields list)
   ═══════════════════════════════════════════════ */

// For Group A: currency renders as its own half-width row (left side) before the toggle
// For Group B: currency renders alongside quantity (half+half row)
// For Fund: currency renders alongside ter (half+half row)
// For Forex: currency renders alongside quantity (half+half row)
// For RealEstate: currency renders full width after date
// These types render currency INLINE in the fields grid (not appended at end)
// Group A is NOT in this map — it uses CURRENCY_BEFORE_TOGGLE instead
const CURRENCY_INLINE_AFTER: Record<string, string> = {
  fixedincome: "quantity", account: "quantity", crowdlending: "quantity",
  fund: "ter",
  forex: "quantity",
};

// Group A types: currency renders as a standalone half-width row before skip_price_update toggle
const CURRENCY_BEFORE_TOGGLE_TYPES = new Set(["stock", "crypto", "etf", "commodity"]);

/* ═══════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════ */

interface InvestmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogType: AssetType;
  editRow: InvRow | null;
  formData: Record<string, string | boolean>;
  onFormDataChange: (data: Record<string, string | boolean>) => void;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
}

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

export default function InvestmentForm({
  open,
  onOpenChange,
  dialogType,
  editRow,
  formData,
  onFormDataChange,
  saving,
  canSave,
  onSave,
}: InvestmentFormProps) {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);

  const showReinvestDisclaimer =
    (dialogType === "fixedincome" || dialogType === "account" || dialogType === "crowdlending") &&
    formData.reinvest === true;

  const showRentDisclaimer =
    dialogType === "realestate" &&
    formData.monthly_rent !== "" &&
    Number(formData.monthly_rent) > 0;

  /* ── Helper: currency selector widget ─────────────────────── */
  function renderCurrencySelect(half = true) {
    return (
      <div className={half ? "" : "col-span-2"}>
        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-muted-foreground">
          {t("Currency", "Divisa")}
        </label>
        <Select
          value={String(formData.currency || "USD")}
          onValueChange={(v) => {
            const updated: Record<string, string | boolean> = { ...formData, currency: v };
            // For forex: auto-update name when it matches the "Depósito en X" pattern
            if (dialogType === "forex") {
              const cur = String(formData.currency || "USD");
              const autoName = `Depósito en ${cur}`;
              if (!formData.name || formData.name === autoName) {
                updated.name = `Depósito en ${v}`;
              }
            }
            onFormDataChange(updated);
          }}
        >
          <SelectTrigger className="h-9 bg-card/50 backdrop-blur-md border-border text-[#F0F5F1] text-[13px] focus:ring-1 focus:ring-[#C8FF00]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass-dropdown">
            <SelectItem value="USD" className="focus:bg-white/10 cursor-pointer text-[12px] py-1.5 focus:text-white">USD $</SelectItem>
            <SelectItem value="EUR" className="focus:bg-white/10 cursor-pointer text-[12px] py-1.5 focus:text-white">EUR €</SelectItem>
            <SelectItem value="GBP" className="focus:bg-white/10 cursor-pointer text-[12px] py-1.5 focus:text-white">GBP £</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  /* ── Helper: render a single form field ─────────────────────── */
  function renderField(f: FormField, isCreateMode: boolean) {
    if (f.condition && !f.condition(formData)) return null;

    if (f.type === "select") {
      return (
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-muted-foreground">
            {lang === "es" ? f.label_es : f.label_en}
            {f.required && <span className="text-[#FFAA33]"> *</span>}
          </label>
          <Select
            value={String(formData[f.key] ?? "")}
            onValueChange={(val) => onFormDataChange({ ...formData, [f.key]: val })}
          >
            <SelectTrigger className="h-9 bg-card/50 backdrop-blur-md border-border text-[#F0F5F1] text-[13px] focus:ring-1 focus:ring-[#C8FF00]">
              <SelectValue placeholder={f.placeholder} />
            </SelectTrigger>
            <SelectContent className="glass-dropdown">
              {f.options?.map(o => (
                <SelectItem key={o.value} value={o.value} className="focus:bg-white/10 cursor-pointer text-[12px] py-1.5 focus:text-white">
                  {lang === "es" ? o.label_es : o.label_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (f.type === "toggle") {
      return (
        <div className="flex items-center justify-between py-1">
          <label className="text-[11px] font-semibold text-muted-foreground">
            {lang === "es" ? f.label_es : f.label_en}
          </label>
          <button
            onClick={() => onFormDataChange({ ...formData, [f.key]: !formData[f.key] })}
            className="w-10 h-5 rounded-full transition-colors relative"
            style={{
              background: formData[f.key] ? "rgba(200,255,0,0.3)" : "rgba(255,255,255,0.1)",
              border: `1px solid ${formData[f.key] ? "rgba(200,255,0,0.5)" : "var(--border)"}`,
            }}
          >
            <span
              className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all"
              style={{
                left: formData[f.key] ? "calc(100% - 18px)" : "2px",
                background: formData[f.key] ? "var(--primary)" : "var(--muted-foreground)",
              }}
            />
          </button>
        </div>
      );
    }

    // Evaluate conditional required/disabled
    const isRequired = f.required || (f.requiredWhen ? f.requiredWhen(formData) : false);

    // quantity/total_amount mutual exclusion (Group A only)
    let disabled = f.disabledWhen ? f.disabledWhen(formData) : false;
    if (!disabled && dialogType in CURRENCY_INLINE_AFTER) {
      if (f.key === "quantity") {
        const tot = String(formData.total_amount ?? "");
        disabled = tot !== "" && tot !== "0";
      } else if (f.key === "total_amount") {
        const qty = String(formData.quantity ?? "");
        disabled = qty !== "" && qty !== "0";
      }
    }

    // accumulated_interest is read-only on create
    if (f.readOnlyOnCreate && isCreateMode) {
      disabled = true;
    }

    // When buy_price is disabled, show "Auto" placeholder; when enabled, clear it
    const effectivePlaceholder = (f.disabledWhen && f.disabledWhen(formData))
      ? "Auto"
      : (disabled ? f.placeholder : (f.disabledWhen ? "" : f.placeholder));

    return (
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-muted-foreground">
          {lang === "es" ? f.label_es : f.label_en}
          {isRequired && <span className="text-[#FFAA33]"> *</span>}
        </label>
        <Input
          type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
          step={f.step}
          maxLength={f.maxLength}
          placeholder={effectivePlaceholder}
          value={disabled && f.disabledWhen ? "" : String(formData[f.key] ?? "")}
          disabled={disabled}
          onChange={(e) => {
            const val = f.uppercase ? e.target.value.toUpperCase() : e.target.value;
            const updated = { ...formData, [f.key]: val };

            // AUTO-UPDATE end_date when start_date changes for Group B
            if (f.key === "start_date" && GROUP_B_ASSET_TYPES.includes(dialogType as AssetType)) {
              if (val) {
                const start = new Date(val);
                if (!isNaN(start.getTime())) {
                  const end = new Date(start);
                  end.setFullYear(start.getFullYear() + 1);
                  updated.end_date = format(end, "yyyy-MM-dd");
                }
              }
            }

            onFormDataChange(updated);
          }}
          className="h-9 bg-card/50 backdrop-blur-md border-border text-[#F0F5F1] text-[13px] focus-visible:ring-1 focus-visible:ring-[#C8FF00] disabled:opacity-40 disabled:cursor-not-allowed"
        />
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onOpenChange(false)}>
      <DialogContent
        className="glass-dialog max-w-md shadow-2xl"
        style={{ background: "var(--dialog-bg)" }}
      >
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold flex items-center gap-2 text-foreground">
            {(() => {
              const meta = ASSET_TYPE_ICON_META[dialogType] ?? ASSET_TYPE_ICON_META.other;
              const TypeIcon = meta.icon;
              return (
                <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                  <TypeIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                </span>
              );
            })()}
            {editRow
              ? t("Edit", "Editar") + " " + getAssetTypeLabel(dialogType, lang)
              : t("Add", "Añadir") + " " + getAssetTypeLabel(dialogType, lang)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {(() => {
            const fields = getFormFields(dialogType);
            const isCreateMode = !editRow;
            const inlineCurrencyAfter = CURRENCY_INLINE_AFTER[dialogType];
            const elements: React.ReactNode[] = [];
            let i = 0;

            while (i < fields.length) {
              const f = fields[i];
              const next = fields[i + 1];

              // After the inline-currency anchor field, inject currency selector as pair
              if (f.key === inlineCurrencyAfter) {
                elements.push(
                  <div key={f.key + "-currency-pair"} className="grid grid-cols-2 gap-3">
                    {renderField(f, isCreateMode)}
                    {renderCurrencySelect(true)}
                  </div>
                );
                i++;
                continue;
              }

              // For Group A: inject currency as half-width row just before the toggle
              if (f.type === "toggle" && CURRENCY_BEFORE_TOGGLE_TYPES.has(dialogType)) {
                elements.push(
                  <div key="currency-group-a-row" className="grid grid-cols-2 gap-3">
                    {renderCurrencySelect(true)}
                    <div />
                  </div>
                );
                elements.push(<div key={f.key}>{renderField(f, isCreateMode)}</div>);
                i++;
              } else if (f.type === "toggle") {
                elements.push(<div key={f.key}>{renderField(f, isCreateMode)}</div>);
                i++;
              } else if (f.half && next?.half && next.type !== "toggle") {
                elements.push(
                  <div key={f.key + "-pair"} className="grid grid-cols-2 gap-3">
                    {renderField(f, isCreateMode)}
                    {renderField(next!, isCreateMode)}
                  </div>
                );
                i += 2;
              } else {
                elements.push(<div key={f.key}>{renderField(f, isCreateMode)}</div>);
                i++;
              }
            }

            // For realestate: currency renders full width after all fields
            if (dialogType === "realestate") {
              elements.push(
                <div key="currency-realestate">
                  {renderCurrencySelect(false)}
                </div>
              );
            }

            // Disclaimers
            if (showReinvestDisclaimer) {
              elements.push(
                <div key="reinvest-disclaimer" className="rounded-lg px-3 py-2 text-[11px] text-amber-400/80 border border-amber-400/20 bg-amber-400/5">
                  {t(
                    "⚠ When reinvestment is active, interests will be added to your balance as income each period. (Coming soon)",
                    "⚠ Al activar la reinversión, los intereses se añadirán al balance como ingresos al final de cada periodo. (Próximamente)"
                  )}
                </div>
              );
            }

            if (showRentDisclaimer) {
              elements.push(
                <div key="rent-disclaimer" className="rounded-lg px-3 py-2 text-[11px] text-amber-400/80 border border-amber-400/20 bg-amber-400/5">
                  {t(
                    "⚠ Monthly rent will be automatically added to your balance as income each month. (Coming soon)",
                    "⚠ La renta mensual se añadirá automáticamente al balance como ingreso cada mes. (Próximamente)"
                  )}
                </div>
              );
            }

            return elements;
          })()}
        </div>

        <DialogFooter className="flex flex-row gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-9 bg-card/50 backdrop-blur-md border-border text-[rgba(240,245,241,0.60)]"
          >
            {t("Cancel", "Cancelar")}
          </Button>
          <Button
            size="sm"
            disabled={saving || !canSave}
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
