"use client";

import { useState, useEffect, useCallback } from "react";
import { useBudgets } from "@/hooks/data/useBudgets";
import { motion } from "framer-motion";
import { Session } from "@supabase/supabase-js";
import {
  Plus,
} from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLang } from "@/contexts/LangContext";
import { Button } from "@/components/ui/button";
import { normalizeCategory } from "@/lib/categories";
import { getDefaultDate } from "@/lib/date";
import BudgetFormDialog, { type Budget, type BudgetForm as BudgetFormType } from "./goals/budgets/BudgetForm";
import BudgetList from "./goals/budgets/BudgetList";
import SavingsPotFormDialog, { type SavingsPot, type SavingsPotForm as SavingsPotFormType } from "./goals/savings/SavingsPotForm";
import SavingsPotList from "./goals/savings/SavingsPotList";
import SavingsDepositModal, { type ContributionForm as ContributionFormType } from "./goals/savings/SavingsDepositModal";
import { addBudget, updateBudget, deleteBudget } from "@/services/budgets";
import {
  addSavingsPot,
  updateSavingsPot,
  deleteSavingsPot,
  getContributions,
  addContribution,
  addWithdrawal,
} from "@/services/savings";
import { addTransaction } from "@/services/transactions";

/* ═══════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════ */
interface Transaction {
  id: string;
  amount: number;
  date: string;
  type: string;
  category: string;
}

interface SavingsContribution {
  id: string;
  amount: number;
  note: string | null;
  date: string;
  created_at: string;
}

interface ObjetivosTabProps {
  transactions: Transaction[];
  session: Session | null;
  refreshKey?: number;
  savingsPots: SavingsPot[];
  onSavingsPotsChange?: () => void;
}

const defaultBudgetForm = (currency: string = "USD"): BudgetFormType => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return {
    name: "",
    type: "expense",
    categories: [],
    amount: "",
    date_from: `${y}-${m}-${d}`,
    date_to: "",
    recurrence: "monthly",
    currency,
  };
};

const defaultPotForm = (currency: string = "USD"): SavingsPotFormType => ({
  name: "",
  target_amount: "",
  categories: [],
  currency,
});

const defaultContribForm = (currency: string = "USD"): ContributionFormType => ({
  amount: "",
  type: "deposit",
  note: "",
  date: getDefaultDate(),
  currency,
});

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function ObjetivosTab({
  transactions,
  session,
  refreshKey,
  savingsPots,
  onSavingsPotsChange,
}: ObjetivosTabProps) {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const { currency } = useCurrency();

  /* ── Budget data hook ──────────────────────────────────────────────── */
  const { budgets, loading, reload: reloadBudgets } = useBudgets(session?.user?.id ?? null, refreshKey);

  /* ── Budget State ──────────────────────────────────────────────────── */
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [budgetForm, setBudgetForm] = useState<BudgetFormType>(defaultBudgetForm(currency));
  const [budgetSaving, setBudgetSaving] = useState(false);

  /* ── Huchas State ──────────────────────────────────────────────────── */
  const [potDialogOpen, setPotDialogOpen] = useState(false);
  const [editPot, setEditPot] = useState<SavingsPot | null>(null);
  const [potForm, setPotForm] = useState<SavingsPotFormType>(defaultPotForm(currency));
  const [potSaving, setPotSaving] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [activePotForAction, setActivePotForAction] = useState<SavingsPot | null>(null);
  const [contribForm, setContribForm] = useState<ContributionFormType>(defaultContribForm(currency));
  const [contribSaving, setContribSaving] = useState(false);
  const [potHistory, setPotHistory] = useState<Record<string, SavingsContribution[]>>({});
  const [potHistoryPage, setPotHistoryPage] = useState<Record<string, number>>({});

  /* ── Section toggle (which section is expanded on mobile) ──────────── */
  const [activeSection, setActiveSection] = useState<"budgets" | "savings">("budgets");

  /* ── Fetch contributions history for a pot ─────────────────────────── */
  const fetchPotHistory = useCallback(async (potId: string) => {
    if (!session) return;
    try {
      const data = await getContributions(session.user.id, potId);
      setPotHistory((prev) => ({ ...prev, [potId]: data }));
    } catch {
      // Keep existing history on error
    }
  }, [session]);

  // Fetch history for all pots on mount/refresh
  useEffect(() => {
    savingsPots.forEach((p) => fetchPotHistory(p.id));
  }, [savingsPots, fetchPotHistory]);

  /* ── Budget CRUD ───────────────────────────────────────────────────── */
  const openCreateBudget = () => {
    setEditBudget(null);
    setBudgetForm(defaultBudgetForm(currency));
    setBudgetDialogOpen(true);
  };

  const openEditBudget = (b: Budget) => {
    setEditBudget(b);
    setBudgetForm({
      name: b.name,
      type: b.type || "expense",
      categories: b.categories,
      amount: String(b.amount),
      date_from: b.date_from ?? "",
      date_to: b.date_to ?? "",
      recurrence: b.recurrence ?? "monthly",
      currency: (b.currency || currency) as "USD" | "EUR" | "GBP",
    });
    setBudgetDialogOpen(true);
  };

  const handleSaveBudget = async () => {
    if (!session || !budgetForm.name || !budgetForm.amount) return;
    setBudgetSaving(true);

    try {
      const payload = {
        name: budgetForm.name,
        type: budgetForm.type,
        categories: budgetForm.categories.slice(0, 3).map(normalizeCategory),
        amount: Math.abs(parseFloat(budgetForm.amount) || 0),
        date_from: budgetForm.date_from || null,
        date_to: budgetForm.date_to || null,
        recurrence: budgetForm.recurrence,
        currency: budgetForm.currency,
      };

      if (editBudget) {
        await updateBudget(editBudget.id, payload);
      } else {
        await addBudget(session.user.id, payload);
      }
      setBudgetSaving(false);
      setBudgetDialogOpen(false);
      reloadBudgets();
    } catch (error) {
      console.error("Error saving budget:", error);
      alert(lang === "es" ? "Error al guardar presupuesto" : "Error saving budget");
      setBudgetSaving(false);
    }
  };

  const handleDeleteBudget = async (b: Budget) => {
    if (!confirm(t(`Delete "${b.name}"?`, `¿Eliminar "${b.name}"?`))) return;
    await deleteBudget(b.id);
    reloadBudgets();
  };

  /* ── Huchas CRUD ───────────────────────────────────────────────────── */
  const openCreatePot = () => {
    setEditPot(null);
    setPotForm(defaultPotForm(currency));
    setPotDialogOpen(true);
  };

  const openEditPot = (pot: SavingsPot) => {
    setEditPot(pot);
    setPotForm({
      name: pot.name,
      target_amount: pot.target_amount ? String(pot.target_amount) : "",
      categories: pot.categories || [],
      currency: (pot.currency || currency) as "USD" | "EUR" | "GBP",
    });
    setPotDialogOpen(true);
  };

  const handleSavePot = async () => {
    if (!session || !potForm.name) return;
    setPotSaving(true);
    try {
      const payload = {
        name: potForm.name,
        target_amount: potForm.target_amount ? parseFloat(potForm.target_amount) : null,
        currency: potForm.currency,
      };

      if (editPot) {
        await updateSavingsPot(editPot.id, payload);
      } else {
        await addSavingsPot(session.user.id, payload);
      }
      setPotSaving(false);
      setPotDialogOpen(false);
      onSavingsPotsChange?.();
    } catch (error) {
      console.error("Error saving pot:", error);
      alert(lang === "es" ? "Error al guardar hucha" : "Error saving pot");
      setPotSaving(false);
    }
  };

  const handleDeletePot = async (pot: SavingsPot) => {
    if (!confirm(t(`Delete "${pot.name}"?`, `¿Eliminar "${pot.name}"?`))) return;
    await deleteSavingsPot(pot.id);
    onSavingsPotsChange?.();
  };

  /* ── Deposit / Withdraw ────────────────────────────────────────────── */
  const openDeposit = (pot: SavingsPot) => {
    setActivePotForAction(pot);
    setContribForm(defaultContribForm(currency));
    setDepositDialogOpen(true);
  };

  const openWithdraw = (pot: SavingsPot) => {
    setActivePotForAction(pot);
    setContribForm(defaultContribForm(currency));
    setWithdrawDialogOpen(true);
  };

  const handleDeposit = async () => {
    if (!session || !activePotForAction || !contribForm.amount) return;
    const amt = parseFloat(contribForm.amount);
    if (amt <= 0) return;
    setContribSaving(true);

    try {
      await addContribution(session.user.id, {
        pot_id: activePotForAction.id,
        amount: amt,
        note: contribForm.note || null,
        date: contribForm.date,
        currency: contribForm.currency,
      });

      // Create corresponding expense transaction
      await addTransaction(session.user.id, {
        amount: amt,
        type: "expense",
        category: "savings_contribution",
        description: activePotForAction.name,
        date: contribForm.date,
        currency: contribForm.currency,
      });

      setContribSaving(false);
      setDepositDialogOpen(false);
      onSavingsPotsChange?.();
      fetchPotHistory(activePotForAction.id);
    } catch (error) {
      console.error("Error making deposit:", error);
      alert(lang === "es" ? "Error al hacer depósito" : "Error making deposit");
      setContribSaving(false);
    }
  };

  const handleWithdraw = async () => {
    if (!session || !activePotForAction || !contribForm.amount) return;
    const amt = parseFloat(contribForm.amount);
    if (amt <= 0) return;
    if (amt > Number(activePotForAction.current_balance)) {
      alert(t("Insufficient balance in this pot", "Saldo insuficiente en esta hucha"));
      return;
    }
    setContribSaving(true);

    try {
      await addWithdrawal(session.user.id, {
        pot_id: activePotForAction.id,
        amount: amt,
        note: contribForm.note || null,
        date: contribForm.date,
        currency: contribForm.currency,
      });

      // Create corresponding income transaction
      await addTransaction(session.user.id, {
        amount: amt,
        type: "income",
        category: "savings_withdrawal",
        description: activePotForAction.name,
        date: contribForm.date,
        currency: contribForm.currency,
      });

      setContribSaving(false);
      setWithdrawDialogOpen(false);
      onSavingsPotsChange?.();
      fetchPotHistory(activePotForAction.id);
    } catch (error) {
      console.error("Error making withdrawal:", error);
      alert(lang === "es" ? "Error al hacer retirada" : "Error making withdrawal");
      setContribSaving(false);
    }
  };

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* Toggle removed from top, moved into section headers */}

      {/* ═══════════════════════════════════════════════════════════════════
         SECTION 1: BUDGETS
         ═══════════════════════════════════════════════════════════════════ */}
      {activeSection === "budgets" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="section-header-group">
              <h2 className="text-title-header">
                {t("Monthly Budgets", "Presupuestos Mensuales")}
              </h2>
              <p className="text-description-header">
                {t("Track spending against budget limits", "Controla tu gasto por categoría")}
              </p>

              {/* Section toggle pills here */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setActiveSection("budgets")}
                  className="tab-pill active"
                  style={{ background: "rgba(255,170,51,0.12)", borderColor: "rgba(255,170,51,0.3)", color: "var(--color-savings)" }}
                >
                  {t("Budgets", "Presupuestos")}
                </button>
                <button
                  onClick={() => setActiveSection("savings")}
                  className="tab-pill"
                >
                  {t("Savings Pots", "Huchas")}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={openCreateBudget}
                size="sm"
                className="btn-primary animate-hover-pill"
                style={{ background: "linear-gradient(135deg, #FFB74D, #FFAA33)" }}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                {t("Add", "Añadir")}
              </Button>
            </div>
          </div>

          <BudgetList
            budgets={budgets}
            transactions={transactions}
            loading={loading}
            onEdit={openEditBudget}
            onDelete={handleDeleteBudget}
            onCreateNew={openCreateBudget}
          />
        </motion.div>
      )
      }

      {/* ═══════════════════════════════════════════════════════════════════
         SECTION 2: SAVINGS POTS (HUCHAS)
         ═══════════════════════════════════════════════════════════════════ */}
      {
        activeSection === "savings" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="section-header-group">
                <h2 className="text-title-header">
                  {t("Savings Pots", "Huchas")}
                </h2>
                <p className="text-description-header">
                  {t("Manage your savings goals", "Gestiona tus objetivos de ahorro")}
                </p>

                {/* Section toggle pills here */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setActiveSection("budgets")}
                    className="tab-pill"
                  >
                    {t("Budgets", "Presupuestos")}
                  </button>
                  <button
                    onClick={() => setActiveSection("savings")}
                    className="tab-pill active"
                  >
                    {t("Savings Pots", "Huchas")}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={openCreatePot}
                  size="sm"
                  className="btn-primary animate-hover-pill"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {t("Add", "Añadir")}
                </Button>
              </div>
            </div>

            <SavingsPotList
              pots={savingsPots}
              potHistory={potHistory}
              potHistoryPage={potHistoryPage}
              onSetPotHistoryPage={(potId, page) => setPotHistoryPage(prev => ({ ...prev, [potId]: page }))}
              onEdit={openEditPot}
              onDelete={handleDeletePot}
              onDeposit={openDeposit}
              onWithdraw={openWithdraw}
              onCreateNew={openCreatePot}
            />
          </motion.div>
        )
      }

      {/* ═══════════════════════════════════════════════════════════════════
         DIALOGS
         ═══════════════════════════════════════════════════════════════════ */}

      <BudgetFormDialog
        open={budgetDialogOpen}
        onOpenChange={(open) => !open && setBudgetDialogOpen(false)}
        editBudget={editBudget}
        form={budgetForm}
        onFormChange={setBudgetForm}
        saving={budgetSaving}
        onSave={handleSaveBudget}
      />

      <SavingsPotFormDialog
        open={potDialogOpen}
        onOpenChange={(open) => !open && setPotDialogOpen(false)}
        editPot={editPot}
        form={potForm}
        onFormChange={setPotForm}
        saving={potSaving}
        onSave={handleSavePot}
      />

      <SavingsDepositModal
        open={depositDialogOpen || withdrawDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDepositDialogOpen(false);
            setWithdrawDialogOpen(false);
          }
        }}
        mode={depositDialogOpen ? "deposit" : "withdraw"}
        pot={activePotForAction}
        form={contribForm}
        onFormChange={setContribForm}
        saving={contribSaving}
        onSubmit={depositDialogOpen ? handleDeposit : handleWithdraw}
      />
    </div>
  );
}
