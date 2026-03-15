"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/contexts/LangContext";

type ErrorType =
  | "mic_denied"
  | "connection_lost"
  | "session_expired"
  | "agent_error"
  | "no_response"
  | "generic"
  | null;

interface ErrorOverlayProps {
  type: ErrorType;
  onClose: () => void;
  onRetry?: () => void;
}

export default function ErrorOverlay({ type, onClose, onRetry }: ErrorOverlayProps) {
  const { t } = useLang();
  if (!type) return null;

  const msg = {
    title: t(`errors.${type}.title`),
    desc: t(`errors.${type}.desc`),
    action: t(`errors.${type}.action`),
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          className="glass-dialog w-full max-w-[360px] rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-expense)" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h2 className="text-[20px] font-bold mb-3 text-foreground">
            {msg.title}
          </h2>

          <p className="text-[14px] leading-relaxed opacity-70 mb-8 text-muted-foreground">
            {msg.desc}
          </p>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={onRetry || onClose}
              className="w-full py-4 rounded-2xl text-[14px] font-bold transition-all bg-white text-black hover:bg-white/90"
            >
              {onRetry ? t("common.retry") : msg.action}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl text-[13px] font-medium opacity-50 hover:opacity-100 transition-opacity text-foreground"
            >
              {t("common.close")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
