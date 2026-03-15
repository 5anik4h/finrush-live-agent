"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ASSET_TYPES, AssetType } from "@/lib/categories";
import { ASSET_TYPE_ICON_META } from "@/lib/categoryIcons";
import { useLang } from "@/contexts/LangContext";

/* ═══════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════ */

interface TypePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: AssetType) => void;
}

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

export default function TypePickerDialog({
  open,
  onOpenChange,
  onSelect,
}: TypePickerDialogProps) {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass-dialog max-w-sm shadow-2xl"
      >
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold text-foreground">
            {t("Select Asset Type", "Tipo de Activo")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-3 auto-rows-fr">
          {ASSET_TYPES.map((typeEntry) => {
            const meta = ASSET_TYPE_ICON_META[typeEntry.value] ?? ASSET_TYPE_ICON_META.other;
            const TypeIcon = meta.icon;
            return (
              <button
                key={typeEntry.value}
                onClick={() => onSelect(typeEntry.value as AssetType)}
                className="flex items-center justify-center gap-2.5 p-3 rounded-xl btn-glass-card text-center min-h-[80px]"
              >
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: meta.bg }}>
                    <TypeIcon className="w-4 h-4" style={{ color: meta.color }} />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground line-clamp-2">
                    {lang === "es" ? typeEntry.label_es : typeEntry.label_en}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
