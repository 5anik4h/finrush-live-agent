"use client";

import { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import {
  Search,
  Download,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  MoreVertical,
  Plus,
  CalendarDays,
} from "lucide-react";
import { getCategoryIcon, CATEGORY_ICONS } from "@/lib/categoryIcons";
import { useExclusiveDropdown } from "@/hooks/useExclusiveDropdown";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  getCategoryLabel,
  normalizeCategory,
  ALL_CATEGORIES,
} from "@/lib/categories";
import { Session } from "@supabase/supabase-js";
import { addTransaction } from "@/services/transactions";
import { type Currency, fmtCurrency } from "@/lib/currency";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLang } from "@/contexts/LangContext";
import { getDefaultDate, getFormattedDateForInput, parseDateFromInput } from "@/lib/date";

/* ── CategoryIconTick (used in parent BarChart, included here for co-location) ─ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CategoryIconTick({ x, y, payload }: any) {
  const iconKey = (payload?.value ?? "other") as string;
  const iconEntries = Object.entries(CATEGORY_ICONS);
  const found = iconEntries.find(([k]) => k === iconKey);
  const Icon = found ? found[1] : CATEGORY_ICONS["other"];
  if (!Icon) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-10} y={2} width={20} height={20}>
        <Icon style={{ width: 14, height: 14, opacity: 0.7, display: "block", margin: "auto" }} />
      </foreignObject>
    </g>
  );
}

/* ── defaultDate helper ─────────────────────────────────────────────── */
// Replaced by getDefaultDate from @/lib/date

export interface Transaction {
  id: string;
  short_id: number;
  amount: number;
  amount_usd?: number;
  rate_at_entry?: number;
  date: string;
  description: string;
  type: string;
  category: string;
  currency?: string;
}

export interface EditForm {
  amount: string;
  description: string;
  category: string;
  type: string;
  date: string;
  currency: "USD" | "EUR" | "GBP";
}

export interface AddForm {
  amount: string;
  description: string;
  category: string;
  type: string;
  date: string;
  currency: "USD" | "EUR" | "GBP";
}

interface TransactionTableProps {
  transactions: Transaction[];
  loading: boolean;
  session: Session | null;
  onDelete: (tx: Transaction) => void;
  onEdit: (tx: Transaction) => void;
  onSaveEdit: (tx: Transaction, form: EditForm) => Promise<void>;
  onExportCSV: () => void;
  onRefresh: () => void;
  onAdd: () => void;
  addDialogOpen: boolean;
  onAddDialogOpenChange: (open: boolean) => void;
  addForm: AddForm;
  onAddFormChange: (form: AddForm) => void;
}

const ROWS_PER_PAGE = 10;

export default function TransactionTable({
  transactions,
  loading,
  session,
  onDelete,
  onSaveEdit,
  onExportCSV,
  onRefresh,
  onAdd,
  addDialogOpen,
  onAddDialogOpenChange,
  addForm,
  onAddFormChange,
}: TransactionTableProps) {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const { fmt, currency: globalCurrency } = useCurrency();

  // ── Dropdown state management ───────────────────────────────────────
  const { openId, setOpen } = useExclusiveDropdown();

  // ── Filters ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [page, setPage] = useState(0);
  const [histMonth, setHistMonth] = useState<string>("all");
  const [histYear, setHistYear] = useState<string>(new Date().getFullYear().toString());

  // ── Edit state (managed internally) ─────────────────────────────────
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    amount: "",
    description: "",
    category: "",
    type: "expense",
    date: "",
    currency: "USD",
  });
  const [saving, setSaving] = useState(false);

  // ── Add dialog local saving state (separate from edit saving) ──────────────
  const [addLocalSaving, setAddLocalSaving] = useState(false);

  // ── Filtering & pagination ───────────────────────────────────────────
  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        tx.description?.toLowerCase().includes(q) ||
        tx.category?.toLowerCase().includes(q);
      const matchCat =
        catFilter === "All" || tx.category?.toLowerCase() === catFilter.toLowerCase();
      const matchType = typeFilter === "All" || tx.type === typeFilter;

      let matchMonth = true;
      let matchYear = true;

      const txDate = new Date(tx.date);
      if (histMonth !== "all") {
        matchMonth = txDate.getMonth() === parseInt(histMonth);
      }
      matchYear = txDate.getFullYear() === parseInt(histYear);

      return matchSearch && matchCat && matchType && matchMonth && matchYear;
    });
  }, [transactions, search, catFilter, typeFilter, histMonth, histYear]);

  const totalPages = Math.max(1, Math.ceil(filteredTxs.length / ROWS_PER_PAGE));

  const paginatedTxs = useMemo(
    () => filteredTxs.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE),
    [filteredTxs, page]
  );

  const filteredCategories = useMemo(() => {
    if (typeFilter === "income") return ["All", ...INCOME_CATEGORIES.map((c) => c.value)];
    if (typeFilter === "expense") return ["All", ...EXPENSE_CATEGORIES.map((c) => c.value)];
    return ["All", ...Array.from(new Set(ALL_CATEGORIES.map((c) => c.value)))];
  }, [typeFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const openEdit = useCallback((tx: Transaction) => {
    setEditTx(tx);
    setEditForm({
      amount: String(tx.amount),
      description: tx.description || "",
      category: normalizeCategory(tx.category || "other"),
      type: tx.type || "expense",
      date: tx.date || getDefaultDate(),
      currency: (tx.currency as "USD" | "EUR" | "GBP") ?? "USD",
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!editTx) return;
    setSaving(true);
    try {
      const currency = (editForm.currency || globalCurrency) as Currency;
      await onSaveEdit(editTx, {
        amount: String(Math.abs(parseFloat(editForm.amount) || 0)),
        description: editForm.description,
        category: normalizeCategory(editForm.category),
        type: editForm.type,
        date: editForm.date,
        currency: currency,
      });
      setSaving(false);
      setEditTx(null);
    } catch (error) {
      console.error("Error saving transaction:", error);
      alert(lang === "es" ? "Error al guardar transacción" : "Error saving transaction");
      setSaving(false);
    }
  }, [editTx, editForm, onSaveEdit, lang, globalCurrency]);

  // ── Add dialog internal handler ──────────────────────────────────────
  const openAddDialog = () => {
    onAddFormChange({
      amount: "",
      description: "",
      category: "other",
      type: "expense",
      date: getDefaultDate(),
      currency: (globalCurrency as "USD" | "EUR" | "GBP") || "USD",
    });
    onAdd();
    onAddDialogOpenChange(true);
  };

  const handleAddSave = async () => {
    if (!session || !addForm.amount) return;
    setAddLocalSaving(true);
    try {
      await addTransaction(session.user.id, {
        amount: Math.abs(parseFloat(addForm.amount) || 0),
        description: addForm.description || "-",
        category: addForm.category,
        type: addForm.type as "income" | "expense",
        date: addForm.date,
        currency: addForm.currency,
      });
      setAddLocalSaving(false);
      onAddDialogOpenChange(false);
      onRefresh();
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert(lang === "es" ? "Error al añadir transacción" : "Error adding transaction");
      setAddLocalSaving(false);
    }
  };

  const addCats = addForm.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const currentCats = editForm.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Helper to capitalize first letter (for month names in Spanish)
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  return (
    <>
      <Card className="border-border backdrop-blur-md overflow-hidden flex flex-col">
        {/* Header */}
        <CardHeader
          className="border-b p-4 flex flex-col gap-3"
          style={{ borderColor: "var(--glass-border)", background: "var(--glass-bg)" }}
        >
          {/* Row 1: Title + Count (left) | spacer | Add Button (right) */}
          <div className="flex items-center gap-3">
            <div className="section-header-group">
              <CardTitle className="text-title-header">
                {t("History", "Historial")}
              </CardTitle>
              <CardDescription className="text-description-header">
                {filteredTxs.length} {t("records", "registros")}
              </CardDescription>
            </div>
            <div className="flex-1" />
            <Button
              onClick={openAddDialog}
              size="sm"
              className="btn-primary animate-hover-pill shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              {t("Add", "Añadir")}
            </Button>
          </div>

          {/* Row 2: Filters */}
          <div className="flex items-center gap-2 flex-wrap w-full">
            <DropdownMenu open={openId === "typeFilter"} onOpenChange={(isOpen) => setOpen(isOpen ? "typeFilter" : null)}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="btn-glass">
                  {typeFilter === "All" ? (
                    <><Filter className="w-3.5 h-3.5 mr-1.5 opacity-60" />{t("Type", "Tipo")}</>
                  ) : typeFilter === "income" ? (
                    <><TrendingUp className="w-3.5 h-3.5 mr-1.5 text-lime-500" />{t("Income", "Ingresos")}</>
                  ) : (
                    <><TrendingDown className="w-3.5 h-3.5 mr-1.5 text-amber-500" />{t("Expenses", "Gastos")}</>
                  )}
                  <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="glass-dropdown">
                <DropdownMenuItem onClick={() => { setTypeFilter("All"); setPage(0); }} className="dropdown-item-focus cursor-pointer text-[12px] py-1.5">
                  <span className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 opacity-60" />
                    {t("All", "Todos")}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setTypeFilter("income"); setPage(0); }} className="dropdown-item-focus cursor-pointer text-[12px] py-1.5">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-lime-500" />
                    {t("Income", "Ingresos")}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setTypeFilter("expense"); setPage(0); }} className="dropdown-item-focus cursor-pointer text-[12px] py-1.5">
                  <span className="flex items-center gap-2">
                    <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
                    {t("Expenses", "Gastos")}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu open={openId === "categoryFilter"} onOpenChange={(isOpen) => setOpen(isOpen ? "categoryFilter" : null)}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="btn-glass">
                  <Filter className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                  {catFilter === "All" ? t("Category", "Categoría") : getCategoryLabel(catFilter, lang)}
                  <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-dropdown max-h-[240px] overflow-y-auto">
                {filteredCategories.map((c) => (
                  <DropdownMenuItem
                    key={c}
                    onClick={() => { setCatFilter(c); setPage(0); }}
                    className="dropdown-item-focus cursor-pointer text-[12px] py-1.5"
                  >
                    <span className="flex items-center gap-2">
                      {c === "All" ? (
                        <Filter className="w-3 h-3 opacity-60" />
                      ) : (
                        (() => {
                          const Icon = getCategoryIcon(c);
                          return <Icon className="w-3 h-3 text-purple-400" />;
                        })()
                      )}
                      {c === "All" ? t("All", "Todas") : getCategoryLabel(c, lang)}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu open={openId === "monthFilter"} onOpenChange={(isOpen) => setOpen(isOpen ? "monthFilter" : null)}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="btn-glass">
                  <CalendarDays className="w-3 h-3 mr-1.5 opacity-60" />
                  {histMonth === "all"
                    ? t("Month", "Mes")
                    : capitalize(format(new Date(2000, parseInt(histMonth), 1), "MMMM", { locale: lang === "es" ? esLocale : undefined }))}
                  <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="glass-dropdown max-h-[200px] overflow-y-auto">
                <DropdownMenuItem onClick={() => { setHistMonth("all"); setPage(0); }} className="dropdown-item-focus text-[12px] py-1.5">
                  {t("All", "Todos")}
                </DropdownMenuItem>
                {Array.from({ length: 12 }).map((_, i) => (
                  <DropdownMenuItem key={i} onClick={() => { setHistMonth(String(i)); setPage(0); }} className="dropdown-item-focus text-[12px] py-1.5">
                    {capitalize(format(new Date(2000, i, 1), "MMMM", { locale: lang === "es" ? esLocale : undefined }))}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu open={openId === "yearFilter"} onOpenChange={(isOpen) => setOpen(isOpen ? "yearFilter" : null)}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="btn-glass">
                  <Filter className="w-3 h-3 mr-1.5 opacity-60" />
                  {histYear}
                  <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="glass-dropdown">
                {[
                  ...new Set([
                    new Date().getFullYear(),
                    ...transactions.map((tx) => new Date(tx.date).getFullYear()),
                  ]),
                ]
                  .sort((a, b) => b - a)
                  .map((y) => (
                    <DropdownMenuItem
                      key={y}
                      onClick={() => { setHistYear(y.toString()); setPage(0); }}
                      className="dropdown-item-focus text-[12px] py-1.5"
                    >
                      {y}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Search */}
            <div className="relative flex-1 min-w-[120px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
              <Input
                type="text"
                placeholder={t("Search…", "Buscar…")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-8 h-8 w-full bg-card/50 backdrop-blur-md border-border text-foreground placeholder:text-muted-foreground/35 text-[12px] focus-visible:ring-1 focus-visible:ring-primary bg-[var(--input-glass-hover)]!"
              />
            </div>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="btn-icon"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            </Button>

            {/* CSV - Pro feature */}
            <div className="relative group">
              <Button
                variant="outline"
                size="sm"
                onClick={onExportCSV}
                className="btn-glass px-2.5 text-[11px] opacity-40 cursor-not-allowed pointer-events-none"
                tabIndex={-1}
                aria-disabled="true"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                CSV
              </Button>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-accent/90 text-[var(--green-deepest)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Pro
              </span>
            </div>
          </div>
        </CardHeader>

        {/* Table */}
        <CardContent className="p-0 flex-1 overflow-x-auto">
          <Table>
            <TableHeader className="bg-card/30 backdrop-blur-md">
              <TableRow className="border-b-[rgba(255,255,255,0.08)] hover:bg-transparent">
                <TableHead className="type-label h-9 px-4 w-[50px]">#</TableHead>
                <TableHead className="type-label h-9 px-4">{t("Date", "Fecha")}</TableHead>
                <TableHead className="type-label h-9 px-4 min-w-[160px]">{t("Description", "Descripción")}</TableHead>
                <TableHead className="type-label h-9 px-4">{t("Category", "Categoría")}</TableHead>
                <TableHead className="type-label h-9 px-4 text-right">{t("Amount", "Cantidad")}</TableHead>
                <TableHead className="w-[40px] px-0 h-9" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="h-5 w-5 rounded-full border-t-2 border-r-2"
                        style={{ borderColor: "var(--primary)", animation: "spin 1s linear infinite" }}
                      />
                      <span className="text-[12px] text-muted-foreground/60">
                        {t("Loading…", "Cargando…")}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredTxs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-[13px] text-muted-foreground/60">
                    {t("No transactions found.", "Sin transacciones encontradas.")}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTxs.map((tx) => (
                  <TableRow
                    key={tx.id}
                    className="border-[rgba(255,255,255,0.04)] select-none transition-colors group hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <TableCell className="text-[10px] font-mono px-4 text-muted-foreground/60">
                      {tx.short_id}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[11px] px-4 text-muted-foreground font-medium">
                      {tx.date ? format(new Date(tx.date), "MMM d, yy") : "—"}
                    </TableCell>
                    <TableCell
                      className="text-[12px] font-medium max-w-[200px] truncate px-4 text-foreground"
                      title={tx.description}
                    >
                      {tx.description || "—"}
                    </TableCell>
                    <TableCell className="px-4">
                      {tx.category ? (() => {
                        const CatIcon = getCategoryIcon(tx.category);
                        return (
                          <span className="badge-category">
                            <CatIcon className="w-2.5 h-2.5 shrink-0" />
                            {getCategoryLabel(tx.category, lang)}
                          </span>
                        );
                      })() : (
                        <span className="text-[10px] text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-right text-[12px] font-bold px-4"
                      style={{ color: tx.type === "expense" ? "var(--color-savings)" : "var(--primary)" }}
                    >
                      {tx.type === "income" ? "+" : "−"}
                      {tx.currency === globalCurrency ? (
                        fmtCurrency(tx.amount, tx.currency as Currency)
                      ) : (
                        fmt(Number(tx.amount_usd ?? tx.amount))
                      )}
                    </TableCell>
                    <TableCell className="px-2 text-right">
                      <DropdownMenu open={openId === `tx-${tx.id}`} onOpenChange={(isOpen) => setOpen(isOpen ? `tx-${tx.id}` : null)}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 btn-row-action">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32 glass-dropdown">
                          <DropdownMenuItem
                            onClick={() => {
                              setOpen(null);
                              openEdit(tx);
                            }}
                            className="focus:bg-primary/10 cursor-pointer text-[12px] gap-2"
                          >
                            <Pencil className="h-3.5 w-3.5 text-primary" />
                            {t("Edit", "Editar")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setOpen(null);
                              onDelete(tx);
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
        <div
          className="flex items-center justify-between px-4 py-2.5 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-30 hover:bg-[rgba(255,255,255,0.08)] disabled:hover:bg-transparent text-muted-foreground font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {t("Prev", "Ant.")}
          </button>
          <span className="text-[11px] text-muted-foreground/60">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-30 hover:bg-[rgba(255,255,255,0.08)] disabled:hover:bg-transparent text-muted-foreground font-medium"
          >
            {t("Next", "Sig.")}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </Card>

      {/* Add Transaction Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => !open && onAddDialogOpenChange(false)}>
        <DialogContent className="glass-dialog max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-bold text-foreground">
              {t("New Transaction", "Nueva Transacción")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Row 1: Description (full width) */}
            <div>
              <label className="type-label block mb-1.5">
                {t("Description", "Descripción")}
              </label>
              <Input
                value={addForm.description}
                onChange={(e) => onAddFormChange({ ...addForm, description: e.target.value })}
                placeholder={t("e.g. Grocery shopping", "ej. Compra supermercado")}
                className="h-9 bg-card/50 backdrop-blur-md border-border text-foreground text-[13px] focus-visible:ring-1 focus-visible:ring-primary"
                maxLength={50}
              />
            </div>

            {/* Row 2: Amount | Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="type-label block mb-1.5">
                  {t("Amount", "Cantidad")}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addForm.amount}
                  onChange={(e) => onAddFormChange({ ...addForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="h-9 bg-card/50 backdrop-blur-md border-border text-foreground text-[13px] focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
              <div>
                <label className="type-label block mb-1.5">
                  {t("Currency", "Divisa")}
                </label>
                <Select
                  value={addForm.currency}
                  onValueChange={(v) => onAddFormChange({ ...addForm, currency: v as "USD" | "EUR" | "GBP" })}
                >
                  <SelectTrigger className="h-9 bg-card/50 backdrop-blur-md border-border text-foreground text-[13px] focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-dropdown">
                    <SelectItem value="USD">USD $</SelectItem>
                    <SelectItem value="EUR">EUR €</SelectItem>
                    <SelectItem value="GBP">GBP £</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Category | Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="type-label block mb-1.5">
                  {t("Category", "Categoría")}
                </label>
                <Select
                  value={addForm.category}
                  onValueChange={(v) => onAddFormChange({ ...addForm, category: v })}
                >
                  <SelectTrigger className="h-9 bg-card/50 backdrop-blur-md border-border text-foreground text-[13px] focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-dropdown">
                    {addCats.map((cat) => {
                      const CatIcon = getCategoryIcon(cat.value);
                      return (
                        <SelectItem key={cat.value} value={cat.value}>
                          <span className="flex items-center gap-2">
                            <CatIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                            {lang === "es" ? cat.label_es : cat.label_en}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="type-label block mb-1.5">
                  {t("Type", "Tipo")}
                </label>
                <Select
                  value={addForm.type}
                  onValueChange={(v) => onAddFormChange({ ...addForm, type: v, category: "other" })}
                >
                  <SelectTrigger className="h-9 bg-card/50 backdrop-blur-md border-border text-foreground text-[13px] focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-dropdown">
                    <SelectItem value="expense">
                      <span className="flex items-center gap-2">
                        <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
                        {t("Expense", "Gasto")}
                      </span>
                    </SelectItem>
                    <SelectItem value="income">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-lime-500" />
                        {t("Income", "Ingreso")}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 4: Date (full width) */}
            <div>
              <label className="type-label block mb-1.5">
                {t("Date", "Fecha")}
              </label>
              <Input
                type="date"
                value={getFormattedDateForInput(addForm.date)}
                onChange={(e) => onAddFormChange({ ...addForm, date: parseDateFromInput(addForm.date, e.target.value) })}
                className="h-9 bg-card/50 backdrop-blur-md border-border text-foreground text-[13px] focus-visible:ring-1 focus-visible:ring-primary [color-scheme:dark]"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-2 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddDialogOpenChange(false)}
              className="flex-1 h-9 bg-card/50 backdrop-blur-md border-border text-[rgba(240,245,241,0.60)]"
            >
              {t("Cancel", "Cancelar")}
            </Button>
            <Button
              size="sm"
              disabled={addLocalSaving || !addForm.amount}
              onClick={handleAddSave}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {addLocalSaving ? t("Saving…", "Guardando…") : t("Save", "Guardar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={!!editTx} onOpenChange={(open) => !open && setEditTx(null)}>
        <DialogContent className="glass-dialog max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-bold text-foreground">
              {t("Edit Transaction", "Editar Transacción")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="type-label block mb-1.5">
                {t("Description", "Descripción")}
              </label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                className="h-9 bg-card/50 backdrop-blur-md border-border text-foreground text-[13px] focus-visible:ring-1 focus-visible:ring-primary"
                maxLength={50}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="type-label block mb-1.5">
                  {t("Amount", "Cantidad")}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                  className="h-9 bg-card/50 backdrop-blur-md border-border text-foreground text-[13px] focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
              <div>
                <label className="type-label block mb-1.5">
                  {t("Currency", "Divisa")}
                </label>
                <Select
                  value={editForm.currency}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, currency: v as "USD" | "EUR" | "GBP" }))}
                >
                  <SelectTrigger className="h-9 bg-card/50 backdrop-blur-md border-border text-foreground text-[13px] focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-dropdown">
                    <SelectItem value="USD">USD $</SelectItem>
                    <SelectItem value="EUR">EUR €</SelectItem>
                    <SelectItem value="GBP">GBP £</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="type-label block mb-1.5">
                  {t("Type", "Tipo")}
                </label>
                <Select
                  value={editForm.type}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, type: v, category: "other" }))}
                >
                  <SelectTrigger className="h-9 bg-card/50 backdrop-blur-md border-border text-foreground text-[13px] focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-dropdown">
                    <SelectItem value="expense">
                      <span className="flex items-center gap-2">
                        <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
                        {t("Expense", "Gasto")}
                      </span>
                    </SelectItem>
                    <SelectItem value="income">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-lime-500" />
                        {t("Income", "Ingreso")}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="type-label block mb-1.5">
                {t("Category", "Categoría")}
              </label>
              <Select
                value={editForm.category}
                onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="h-9 bg-card/50 backdrop-blur-md border-border text-foreground text-[13px] focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-dropdown">
                  {currentCats.map((cat) => {
                    const CatIcon = getCategoryIcon(cat.value);
                    return (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          <CatIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                          {lang === "es" ? cat.label_es : cat.label_en}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="type-label block mb-1.5">
                {t("Date", "Fecha")}
              </label>
              <Input
                type="date"
                value={getFormattedDateForInput(editForm.date)}
                onChange={(e) => setEditForm((f) => ({ ...f, date: parseDateFromInput(f.date, e.target.value) }))}
                className="h-9 bg-card/50 backdrop-blur-md border-border text-foreground text-[13px] focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-2 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditTx(null)}
              className="flex-1 h-9 bg-card/50 backdrop-blur-md border-border text-[rgba(240,245,241,0.60)]"
            >
              {t("Cancel", "Cancelar")}
            </Button>
            <Button
              size="sm"
              disabled={saving || !editForm.amount}
              onClick={handleSave}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {saving ? t("Saving…", "Guardando…") : t("Save", "Guardar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
