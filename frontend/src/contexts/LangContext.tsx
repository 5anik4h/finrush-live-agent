"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { en, es, t as tFn, type Lang, type Translations } from "@/lib/i18n";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Shorthand translation helper bound to the current lang. */
  t: (key: string, variables?: Record<string, string | number>) => string;
  /** Raw locale object for components that need both label_en/label_es keys. */
  locale: Translations;
}

const LangContext = createContext<LangContextValue | null>(null);

function getSavedLang(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("finrush_lang");
  return stored === "es" ? "es" : "en";
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getSavedLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("finrush_lang", l);
    }
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      t: (key: string, variables?: Record<string, string | number>) => tFn(lang, key, variables),
      locale: lang === "es" ? es : en,
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}
