"use client";

import { motion } from "framer-motion";
import { type Currency, CURRENCIES } from "@/lib/currency";
import { CurrencyProvider, useCurrency } from "@/contexts/CurrencyContext";
import { useLang } from "@/contexts/LangContext";

const CURRENCY_ORDER: Currency[] = ["USD", "EUR", "GBP"];

function CurrencyButtonInner() {
  const { t } = useLang();
  const { currency, setCurrency } = useCurrency();

  const cycle = () => {
    const next = CURRENCY_ORDER[(CURRENCY_ORDER.indexOf(currency) + 1) % CURRENCY_ORDER.length];
    setCurrency(next);
  };

  return (
    <motion.button
      className="voice-action-btn rounded-full"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={cycle}
      title={t("currency.cycleCurrency")}
    >
      <span className="text-[15px] font-black leading-none text-muted-foreground">
        {CURRENCIES.find((c) => c.value === currency)?.symbol ?? "$"}
      </span>
    </motion.button>
  );
}

/**
 * CurrencyButton — must be used inside a CurrencyProvider.
 * If already wrapped (e.g. dashboard/page.tsx), import CurrencyButtonInner directly.
 * Default export wraps with its own provider for standalone use.
 */
export default function CurrencyButton() {
  return (
    <CurrencyProvider>
      <CurrencyButtonInner />
    </CurrencyProvider>
  );
}

export { CurrencyButtonInner };
