"use client";

import { Badge } from "@/components/ui/badge";
import { ASSET_TYPES, AssetType } from "@/lib/categories";
import { ASSET_TYPE_ICON_META } from "@/lib/categoryIcons";
import { useLang } from "@/contexts/LangContext";
import { type InvRow } from "./InvestmentTable";

/* ═══════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════ */

interface InvestmentNavPillsProps {
  selectedType: AssetType | "all";
  onSelect: (t: AssetType) => void;
  grouped: Partial<Record<AssetType, InvRow[]>>;
  fmt: (n: number, dec?: number) => string;
}

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

export default function InvestmentNavPills({
  selectedType,
  onSelect,
  grouped,
  fmt,
}: InvestmentNavPillsProps) {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);

  return (
    <div
      className="overflow-x-auto lg:overflow-visible snap-x snap-mandatory scrollbar-none -mx-4 px-4"
      style={{ scrollbarWidth: "none" }}
    >
      <div className="flex gap-2 pb-4 lg:grid lg:grid-cols-5 lg:min-w-0 lg:w-full lg:gap-3 lg:pb-0">

        {/* Per-type pills */}
        {ASSET_TYPES.map((typeEntry) => {
          const type = typeEntry.value as AssetType;
          const typeRows = grouped[type] ?? [];
          const val = typeRows.reduce((s, r) => s + r.current_value, 0);
          const cost = typeRows.reduce((s, r) => s + r.invested_amount, 0);
          const gain = val - cost;
          const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
          const isActive = selectedType === type;
          const meta = ASSET_TYPE_ICON_META[type] ?? ASSET_TYPE_ICON_META.other;
          const TypeIcon = meta.icon;

          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className={`flex flex-col items-start px-3 py-2.5 rounded-xl border transition-all snap-center shrink-0 w-[calc(50vw-24px)] lg:w-auto animate-hover-pill ${isActive
                ? "bg-primary/10 border-primary/30"
                : "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15]"
                }`}
              style={{ opacity: typeRows.length === 0 ? 0.45 : 1, borderRadius: "var(--radius)" }}
            >
              <div className="flex items-center gap-1.5 w-full">
                <TypeIcon className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? "var(--primary)" : meta.color }} />
                <span className="text-[10px] font-bold uppercase tracking-wider flex-1 text-left truncate whitespace-nowrap" style={{ color: isActive ? "var(--primary)" : "var(--muted-foreground)" }}>
                  {lang === "es" ? typeEntry.label_es : typeEntry.label_en}
                </span>
                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 ml-auto" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                  {typeRows.length}
                </Badge>
              </div>
              {typeRows.length > 0 ? (
                <>
                  <span className="text-[17px] font-bold mt-1.5" style={{ color: isActive ? "var(--foreground)" : "var(--muted-foreground)" }}>
                    {fmt(val, 0)}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[12px] font-semibold" style={{ color: gain >= 0 ? "var(--primary)" : "var(--destructive)" }}>
                      {gain >= 0 ? "+" : ""}{fmt(gain, 0)}
                    </span>
                    <span className="text-[10px] opacity-60" style={{ color: gain >= 0 ? "var(--primary)" : "var(--destructive)" }}>
                      ({gain >= 0 ? "+" : ""}{gainPct.toFixed(1)}%)
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-[9px] italic mt-2 text-muted-foreground/60">{t("No positions", "Sin posiciones")}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
