/**
 * Centralized monochromatic icon map for categories and asset types.
 * Shared across MovimientosTab, PresupuestosTab, and InversionTab.
 */
import type { LucideIcon } from "lucide-react";
import {
    // Expense category icons
    Home,
    Bus,
    ShoppingCart,
    Utensils,
    Car,
    Gamepad2,
    HeartPulse,
    Coffee,
    PawPrint,
    Gift,
    Sparkles,
    GraduationCap,
    ShoppingBag,
    Plane,
    Receipt,
    HelpCircle,
    CreditCard,
    PiggyBank,
    Smartphone,
    // Income category icons
    Briefcase,
    FileText,
    BarChart3,
    Tag,
    Building2,
    TrendingUp,
    Coins,
    Banknote,
    // Asset type icons
    LineChart,
    Bitcoin,
    Package,
    Users,
    Gem,
    DollarSign,
    CircleDollarSign,
    Landmark,
    Award,
    Percent,
    Wallet,
} from "lucide-react";

// ── Category icon map ────────────────────────────────────────────────────────
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
    // expenses
    supermarket: ShoppingCart,
    house: Home,
    vehicle: Car,
    transport: Bus,
    shopping: ShoppingBag,
    entertainment: Gamepad2,
    health: HeartPulse,
    snacks: Coffee,
    pets: PawPrint,
    gifts: Gift,
    beauty: Sparkles,
    education: GraduationCap,
    travel: Plane,
    bills: Receipt,
    restaurants: Utensils,
    subscriptions: Smartphone,
    taxes: Landmark,
    investment_transfer: CreditCard,
    savings_contribution: PiggyBank,
    // income
    salary: Briefcase,
    freelance: FileText,
    investments: BarChart3,
    interests: Banknote,
    dividends: Coins,
    sales: Tag,
    rental_income: Building2,
    savings_withdrawal: PiggyBank,
    investment_return: TrendingUp,
    awards: Award,
    // fallback
    other: HelpCircle,
};

export function getCategoryIcon(value: string): LucideIcon {
    const key = value?.toLowerCase() ?? "other";
    return CATEGORY_ICONS[key] ?? CircleDollarSign;
}

// ── Asset type icon map (with color and bg for design system) ────────────────
export const ASSET_TYPE_ICON_META: Record<
    string,
    { icon: LucideIcon; color: string; bg: string }
> = {
    // Group A — Tradeables
    stock:       { icon: LineChart,  color: "#C8FF00", bg: "rgba(200,255,0,0.10)" },
    commodity:   { icon: Gem,        color: "#FCD34D", bg: "rgba(252,211,77,0.10)" },
    crypto:      { icon: Bitcoin,    color: "#FFAA33", bg: "rgba(255,170,51,0.10)" },
    etf:         { icon: Package,    color: "#B388FF", bg: "rgba(179,136,255,0.10)" },
    fund:        { icon: Landmark,   color: "#A78BFA", bg: "rgba(167,139,250,0.10)" },
    // Group B — Interest-bearing
    fixedincome: { icon: Percent,    color: "#34D399", bg: "rgba(52,211,153,0.10)" },
    crowdlending:{ icon: Users,      color: "#5EEAD4", bg: "rgba(94,234,212,0.10)" },
    account:     { icon: Wallet,     color: "#60A5FA", bg: "rgba(96,165,250,0.10)" },
    // Group C — Special
    realestate:  { icon: Building2,  color: "#F97316", bg: "rgba(249,115,22,0.10)" },
    forex:       { icon: DollarSign, color: "#38BDF8", bg: "rgba(56,189,248,0.10)" },
    // Fallback
    other:       { icon: Briefcase,  color: "rgba(240,245,241,0.60)", bg: "rgba(255,255,255,0.06)" },
};
