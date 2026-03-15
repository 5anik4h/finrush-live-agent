"use client";

import { format } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAssetTypeLabel, AssetType } from "@/lib/categories";
import { useLang } from "@/contexts/LangContext";
import { useExclusiveDropdown } from "@/hooks/useExclusiveDropdown";

/* ═══════════════════════════════════════════════
   EXPORTED TYPES
   ═══════════════════════════════════════════════ */

export interface InvRow {
  id: string;
  short_id: number;
  asset_type: AssetType;
  name: string;
  invested_amount: number;
  current_value: number;
  pnl: number;
  pnl_pct: number;
  raw: Record<string, unknown>;
}

export interface ColDef {
  header_en: string;
  header_es: string;
  render: (row: InvRow, fmt: (n: number, d?: number) => string) => React.ReactNode;
  align?: "right";
}

/* ═══════════════════════════════════════════════
   PNL COLUMN HELPER
   ═══════════════════════════════════════════════ */

export function pnlColumn(): ColDef {
  return {
    header_en: "P&L",
    header_es: "G/P",
    render: (r, fmt) => (
      <div className="flex items-center gap-1.5 justify-end">
        {r.pnl >= 0
          ? <TrendingUp className="w-3 h-3 shrink-0" style={{ color: "var(--color-investment)" }} />
          : <TrendingDown className="w-3 h-3 shrink-0" style={{ color: "var(--color-investment)" }} />}
        <div className="flex flex-col items-end">
          <span className="text-[11px] font-semibold" style={{ color: r.pnl >= 0 ? "var(--color-income)" : "var(--color-savings)" }}>
            {r.pnl >= 0 ? "+" : "−"}{fmt(Math.abs(r.pnl), 0)}
          </span>
          <span className="text-[10px] opacity-75" style={{ color: r.pnl >= 0 ? "var(--color-income)" : "var(--color-savings)" }}>
            {r.pnl_pct.toFixed(1)}%
          </span>
        </div>
      </div>
    ),
  };
}

/* ═══════════════════════════════════════════════
   TYPE-SPECIFIC TABLE COLUMNS
   ═══════════════════════════════════════════════ */

export function getColumns(type: AssetType): ColDef[] {
  const base: ColDef[] = [
    {
      header_en: "#",
      header_es: "#",
      render: (r) => <span className="text-[10px] font-mono text-muted-foreground/60">{r.short_id}</span>,
    },
  ];

  switch (type) {
    // GROUP A: stock, crypto, etf, commodity — unified columns
    case "stock":
    case "crypto":
    case "commodity":
    case "etf":
      return [
        ...base,
        { header_en: "Ticker", header_es: "Ticker", render: (r) => <span className="font-bold text-[12px] text-foreground">{String(r.raw.ticker ?? "")}</span> },
        { header_en: "Name", header_es: "Nombre", render: (r) => <span className="text-[10px] max-w-[100px] truncate block text-muted-foreground/60">{r.name}</span> },
        { header_en: "Qty", header_es: "Cant.", render: (r) => <span className="text-[11px] text-muted-foreground font-medium">{parseFloat(Number(r.raw.quantity ?? 0).toFixed(4))}</span>, align: "right" },
        { header_en: "Buy Price", header_es: "P. Compra", render: (r, fmt) => <span className="text-[11px] text-muted-foreground font-medium">{fmt(Number(r.raw.buy_price_usd ?? r.raw.buy_price ?? 0))}</span>, align: "right" },
        { header_en: "Current", header_es: "Actual", render: (r, fmt) => <span className="text-[11px] text-foreground">{fmt(Number(r.raw.current_price_usd ?? r.raw.current_price ?? r.raw.buy_price_usd ?? r.raw.buy_price ?? 0))}</span>, align: "right" },
        { header_en: "Value", header_es: "Valor", render: (r, fmt) => <span className="text-[12px] font-bold text-primary">{fmt(r.current_value)}</span>, align: "right" },
        pnlColumn(),
      ];

    case "fund":
      return [
        ...base,
        { header_en: "Name", header_es: "Nombre", render: (r) => <span className="text-[11px] max-w-[120px] truncate block text-foreground">{r.name}</span> },
        { header_en: "Qty", header_es: "Partic.", render: (r) => <span className="text-[11px] text-muted-foreground font-medium">{parseFloat(Number(r.raw.quantity ?? 0).toFixed(4))}</span>, align: "right" },
        { header_en: "Buy Price", header_es: "P. Compra", render: (r, fmt) => <span className="text-[11px] text-muted-foreground font-medium">{fmt(Number(r.raw.buy_price_usd ?? r.raw.buy_price ?? 0))}</span>, align: "right" },
        { header_en: "Current", header_es: "Actual", render: (r, fmt) => <span className="text-[11px] text-foreground">{fmt(r.current_value)}</span>, align: "right" },
        { header_en: "TER %", header_es: "TER %", render: (r) => <span className="text-[11px] text-muted-foreground font-medium">{r.raw.ter != null ? `${Number(r.raw.ter).toFixed(2)}%` : "—"}</span>, align: "right" },
        pnlColumn(),
      ];

    // GROUP B: fixedincome, account, crowdlending — unified columns
    case "fixedincome":
    case "account":
    case "crowdlending":
      return [
        ...base,
        { header_en: "Platform / Entity", header_es: "Plataforma", render: (r) => <span className="text-[11px] font-bold text-foreground max-w-[120px] truncate block">{r.name}</span> },
        { header_en: "Capital", header_es: "Capital", render: (r, fmt) => <span className="text-[11px] text-muted-foreground font-medium">{fmt(r.invested_amount)}</span>, align: "right" },
        { header_en: "APY %", header_es: "APY %", render: (r) => <span className="text-[11px] font-medium" style={{ color: "var(--color-income)" }}>{Number(r.raw.apy ?? 0).toFixed(2)}%</span>, align: "right" },
        { header_en: "Interest", header_es: "Intereses", render: (r, fmt) => <span className="text-[11px] font-semibold text-primary">{fmt(r.current_value - r.invested_amount)}</span>, align: "right" },
        { header_en: "Total", header_es: "Total", render: (r, fmt) => <span className="text-[12px] font-bold text-primary">{fmt(r.current_value)}</span>, align: "right" },
        { header_en: "Reinvest", header_es: "Reinv.", render: (r) => <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4" style={{ borderColor: r.raw.reinvest ? "rgba(200,255,0,0.3)" : "var(--border)", color: r.raw.reinvest ? "var(--primary)" : "var(--muted-foreground)" }}>{r.raw.reinvest ? "ON" : "OFF"}</Badge> },
      ];

    case "realestate":
      return [
        ...base,
        { header_en: "Property", header_es: "Propiedad", render: (r) => <span className="text-[11px] font-bold max-w-[120px] truncate block text-foreground">{r.name}</span> },
        { header_en: "Purchase", header_es: "Compra", render: (r, fmt) => <span className="text-[11px] text-muted-foreground font-medium">{fmt(Number(r.raw.purchase_price_usd ?? r.raw.purchase_price ?? 0))}</span>, align: "right" },
        { header_en: "Mortgage", header_es: "Hipoteca", render: (r, fmt) => <span className="text-[11px]" style={{ color: "var(--color-savings)" }}>{fmt(Number(r.raw.pending_mortgage_usd ?? r.raw.pending_mortgage ?? 0))}</span>, align: "right" },
        { header_en: "Est. Value", header_es: "Valor Est.", render: (r, fmt) => <span className="text-[11px] text-foreground">{fmt(Number(r.raw.estimated_value_usd ?? r.raw.estimated_value ?? 0))}</span>, align: "right" },
        { header_en: "Equity", header_es: "Equity", render: (r, fmt) => <span className="text-[12px] font-bold text-primary">{fmt(r.current_value)}</span>, align: "right" },
        { header_en: "Rent/mo", header_es: "Alquiler/mes", render: (r, fmt) => <span className="text-[11px]" style={{ color: r.raw.monthly_rent_usd ?? r.raw.monthly_rent ? "var(--primary)" : "var(--muted-foreground)" }}>{r.raw.monthly_rent_usd ?? r.raw.monthly_rent ? fmt(Number(r.raw.monthly_rent_usd ?? r.raw.monthly_rent)) : "—"}</span>, align: "right" },
      ];

    case "forex":
      return [
        ...base,
        { header_en: "Name", header_es: "Nombre", render: (r) => <span className="text-[11px] font-bold text-foreground max-w-[120px] truncate block">{r.name}</span> },
        { header_en: "Currency", header_es: "Divisa", render: (r) => <span className="text-[12px] font-bold text-foreground">{String(r.raw.currency ?? "—")}</span> },
        { header_en: "Amount", header_es: "Cantidad", render: (r) => <span className="text-[11px] text-muted-foreground font-medium">{Number(r.raw.quantity ?? 0).toLocaleString()}</span>, align: "right" },
        { header_en: "Value", header_es: "Valor", render: (r, fmt) => <span className="text-[12px] font-bold text-primary">{fmt(r.current_value)}</span>, align: "right" },
      ];

    default:
      return base;
  }
}

/* ═══════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════ */

interface InvestmentTableProps {
  rows: InvRow[];
  allRows: InvRow[];
  activeRows: InvRow[];
  loading: boolean;
  columns: ColDef[];
  page: number;
  totalPages: number;
  histMonth: string;
  histYear: string;
  searchQ: string;
  activePill: AssetType | "all";
  onPageChange: (p: number) => void;
  onHistMonthChange: (m: string) => void;
  onHistYearChange: (y: string) => void;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onEdit: (row: InvRow) => void;
  onDelete: (row: InvRow) => void;
  loadingRefresh?: boolean;
  fmt: (n: number, dec?: number) => string;
}

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

export default function InvestmentTable({
  rows,
  allRows,
  activeRows,
  loading,
  columns,
  page,
  totalPages,
  histMonth,
  histYear,
  searchQ,
  activePill,
  onPageChange,
  onHistMonthChange,
  onHistYearChange,
  onSearchChange,
  onRefresh,
  onAdd,
  onEdit,
  onDelete,
  loadingRefresh,
  fmt,
}: InvestmentTableProps) {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const { openId, setOpen } = useExclusiveDropdown();

  // Helper to capitalize first letter (for month names in Spanish)
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  return (
    <Card className="border-border backdrop-blur-md overflow-hidden">
      <CardHeader
        className="border-b px-4 pt-4 pb-3 flex flex-col gap-3"
        style={{ borderColor: "var(--glass-border)", background: "var(--glass-bg)" }}
      >
        {/* Row 1: Title + Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="section-header-group">
            <CardTitle className="text-title-header">
              {activePill === "all" ? t("All Assets", "Todos los Activos") : getAssetTypeLabel(activePill as AssetType, lang)}
            </CardTitle>
            <CardDescription className="text-description-header">
              {activeRows.length} {t("assets tracked", "activos registrados")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Add */}
            <Button
              onClick={onAdd}
              size="sm"
              className="btn-primary animate-hover-pill"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              {t("Add", "Añadir")}
            </Button>
          </div>
        </div>

        {/* Row 2: Filters — Mes, Año, Buscar (flex-1), Refrescar, CSV */}
        <div className="flex items-center gap-2 flex-wrap w-full">
          {/* Mes */}
          <DropdownMenu open={openId === "monthFilter"} onOpenChange={(isOpen) => setOpen(isOpen ? "monthFilter" : null)}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="btn-glass"
              >
                <CalendarDays className="w-3 h-3 mr-1.5 opacity-60" />
                {histMonth === "all" ? t("Month", "Mes") : capitalize(format(new Date(2000, parseInt(histMonth), 1), "MMMM", { locale: lang === "es" ? esLocale : undefined }))}
                <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="glass-dropdown max-h-[200px] overflow-y-auto">
              <DropdownMenuItem onClick={() => { onHistMonthChange("all"); onPageChange(0); }} className="dropdown-item-focus text-[12px] py-1.5">{t("All", "Todos")}</DropdownMenuItem>
              {Array.from({ length: 12 }).map((_, i) => (
                <DropdownMenuItem key={i} onClick={() => { onHistMonthChange(String(i)); onPageChange(0); }} className="dropdown-item-focus text-[12px] py-1.5">
                  {capitalize(format(new Date(2000, i, 1), "MMMM", { locale: lang === "es" ? esLocale : undefined }))}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Year */}
          <DropdownMenu open={openId === "yearFilter"} onOpenChange={(isOpen) => setOpen(isOpen ? "yearFilter" : null)}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="btn-glass"
              >
                <Filter className="w-3 h-3 mr-1.5 opacity-60" />
                {histYear === "all" ? t("All", "Todos") : histYear}
                <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="glass-dropdown">
              <DropdownMenuItem onClick={() => { onHistYearChange("all"); onPageChange(0); }} className="dropdown-item-focus text-[12px] py-1.5">{t("All", "Todos")}</DropdownMenuItem>
              {[...new Set([new Date().getFullYear(), ...allRows.map(r => new Date((r.raw?.created_at as string) || new Date()).getFullYear())])].sort((a, b) => b - a).map((y) => (
                <DropdownMenuItem key={y} onClick={() => { onHistYearChange(y.toString()); onPageChange(0); }} className="dropdown-item-focus text-[12px] py-1.5">{y}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search (extended) */}
          <div className="relative flex-1 min-w-[120px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <Input
              type="text"
              placeholder={t("Search...", "Buscar...")}
              value={searchQ}
              onChange={(e) => { onSearchChange(e.target.value); onPageChange(0); }}
              className="w-full h-8 pl-8 pr-3 bg-card/50 backdrop-blur-md border-border text-[12px] text-foreground focus-visible:ring-1 focus-visible:ring-primary/40 placeholder:text-muted-foreground/40 bg-[var(--input-glass-hover)]!"
            />
          </div>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading || loadingRefresh}
            className="btn-icon"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingRefresh ? "animate-spin text-primary" : ""}`} />
          </Button>

          {/* CSV - Pro feature */}
          <div className="relative group">
            <Button
              variant="outline"
              size="sm"
              className="btn-glass px-2.5 text-[11px] opacity-40 cursor-not-allowed pointer-events-none"
              tabIndex={-1}
              aria-disabled="true"
            >
              <Download className="w-3 h-3 mr-1.5" />
              CSV
            </Button>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-accent/90 text-[var(--green-deepest)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Pro
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader className="bg-card/30 backdrop-blur-md">
            <TableRow className="border-[rgba(255,255,255,0.08)] hover:bg-transparent">
              {columns.map((col, i) => (
                <TableHead
                  key={i}
                  className="text-[10px] uppercase tracking-wider h-8 px-3 font-semibold"
                  style={{ color: "var(--muted-foreground)", textAlign: col.align ?? "left" }}
                >
                  {lang === "es" ? col.header_es : col.header_en}
                </TableHead>
              ))}
              <TableHead className="text-[10px] h-8 px-2 w-[40px] text-muted-foreground font-medium" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-8 text-[12px] text-muted-foreground/60">
                  {t("No positions found", "Sin posiciones")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                  {columns.map((col, i) => (
                    <TableCell key={i} className="px-3 py-2.5" style={{ textAlign: col.align ?? "left" }}>
                      {col.render(row, fmt)}
                    </TableCell>
                  ))}
                  <TableCell className="px-2">
                    <DropdownMenu open={openId === `inv-${row.id}`} onOpenChange={(isOpen) => setOpen(isOpen ? `inv-${row.id}` : null)}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 btn-row-action">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass-dropdown">
                        <DropdownMenuItem
                          onClick={() => {
                            setOpen(null);
                            onEdit(row);
                          }}
                          className="dropdown-item-focus cursor-pointer text-[12px] gap-2"
                        >
                          <Pencil className="w-3.5 h-3.5 text-primary" />
                          {t("Edit", "Editar")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setOpen(null);
                            onDelete(row);
                          }}
                          className="dropdown-item-focus cursor-pointer text-[12px] gap-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--color-savings)" }} />
                          {t("Delete", "Eliminar")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <button
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page === 0}
          className="h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-30 hover:bg-[rgba(255,255,255,0.08)] disabled:hover:bg-transparent text-muted-foreground font-medium"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {t("Prev", "Ant.")}
        </button>
        <span className="text-[11px] text-muted-foreground/60">
          {page + 1} / {totalPages} · {activeRows.length} {t("assets", "activos")}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-30 hover:bg-[rgba(255,255,255,0.08)] disabled:hover:bg-transparent text-muted-foreground font-medium"
        >
          {t("Next", "Sig.")}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </Card>
  );
}
