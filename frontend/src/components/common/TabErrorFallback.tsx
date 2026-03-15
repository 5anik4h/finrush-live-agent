"use client";

import { useEffect, useMemo } from "react";
import { useLang } from "@/contexts/LangContext";

interface TabErrorFallbackProps {
  tabName: string;
  error: unknown;
  resetErrorBoundary: (...args: unknown[]) => void;
}

export default function TabErrorFallback({
  tabName,
  error,
  resetErrorBoundary,
}: TabErrorFallbackProps) {
  const { lang } = useLang();

  const errorObj = useMemo(
    () => (error instanceof Error ? error : new Error(String(error))),
    [error]
  );

  useEffect(() => {
    // Log to console in dev; Sentry is imported dynamically to avoid SSR issues
    console.error(`[ErrorBoundary] Tab "${tabName}" crashed:`, errorObj);
    import("@sentry/nextjs")
      .then((Sentry) => Sentry.captureException(errorObj, { tags: { tab: tabName } }))
      .catch(() => {/* Sentry not available */});
  }, [errorObj, tabName]);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center border border-red-500/20">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-foreground font-semibold text-lg mb-2">
          {lang === "es" ? "Algo salió mal" : "Something went wrong"}
        </h3>
        <p className="text-muted-foreground text-sm mb-6">
          {lang === "es"
            ? "Esta sección encontró un error inesperado. Las demás pestañas siguen funcionando."
            : "This section encountered an unexpected error. The other tabs are still working."}
        </p>
        {process.env.NODE_ENV === "development" && (
          <pre className="text-left text-xs text-red-400 bg-red-500/10 rounded-lg p-3 mb-4 overflow-auto max-h-32 whitespace-pre-wrap">
            {errorObj.message}
          </pre>
        )}
        <button
          onClick={resetErrorBoundary}
          className="w-full py-2 px-4 rounded-xl font-medium text-sm"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {lang === "es" ? "Reintentar" : "Retry"}
        </button>
      </div>
    </div>
  );
}
