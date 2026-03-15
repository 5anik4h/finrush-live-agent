"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/contexts/LangContext";

interface ChatMessage {
  id: number;
  role: "user" | "agent";
  text: string;
  type: "audio" | "text" | "image";
  timestamp: Date;
}

interface HistoryPopupProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
}

export default function HistoryPopup({ open, onClose, messages }: HistoryPopupProps) {
  const { t } = useLang();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages.length]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="glass-dialog fixed z-[70] right-4 bottom-28 w-[340px] max-w-[calc(100vw-2rem)] max-h-[60vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--glass-border)" }}>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-[13px] font-bold text-foreground">
                  {t("history.title")}
                </span>
              </div>
              <motion.button
                onClick={onClose}
                whileTap={{ scale: 0.9 }}
                className="voice-bar-btn-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.5 }}>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: "none" }}>
              {messages.length === 0 && (
                <p className="text-[11px] text-center py-8 text-muted-foreground opacity-50">
                  {t("history.empty")}
                </p>
              )}
              {messages.map((msg) => (
                <div key={msg.id}>
                  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${msg.role === "user" ? "history-msg-user" : "history-msg-agent"}`}
                    >
                      {msg.type === "image" && msg.role === "user" && (
                        <p className="text-[10px] mb-1 text-muted-foreground opacity-50">📷 Image</p>
                      )}
                      {msg.type === "audio" && msg.role === "user" && (
                        <p className="text-[10px] mb-1 text-muted-foreground opacity-50">🎤 Voice</p>
                      )}
                      <p
                        className="text-[11px] leading-relaxed"
                        style={{ color: msg.role === "user" ? "var(--foreground)" : "var(--muted-foreground)" }}
                      >
                        {msg.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
