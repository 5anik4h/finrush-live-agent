"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/contexts/LangContext";

interface SettingsPopupProps {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
  userId?: string;
  onProfileUpdate?: () => void;
}

export default function SettingsPopup({ open, onClose, onSignOut, userId, onProfileUpdate }: SettingsPopupProps) {
  const { t } = useLang();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [priceUpdatesEnabled, setPriceUpdatesEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("finrush_price_updates_enabled") !== "false";
  });
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setIsLoadingProfile(true);
    setIsEditingName(false); // Reset editing state on open
    try {
      const { createClient } = await import("@/lib/supabase");
      const supabase = createClient();

      // Get session and user for the most up-to-date metadata
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (user) {
        setEmail(user.email || "");

        // Priority 1: Profiles table, Priority 2: User metadata, Priority 3: Email prefix
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_name")
          .eq("id", userId)
          .single();

        const finalName = profile?.user_name || user.user_metadata?.name || user.email?.split("@")[0] || "";
        setUserName(finalName);
        setNewName(finalName);
      }
    } catch (e) {
      console.error("Fetch profile error", e);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) fetchProfile();
  }, [open, fetchProfile]);

  const handleSaveName = async () => {
    if (!userId || !newName.trim()) return;
    setSaveStatus("saving");
    try {
      const { createClient } = await import("@/lib/supabase");
      const supabase = createClient();

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          user_id: userId,
          user_name: newName.trim(),
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });

      if (error) throw error;

      // Update auth metadata too to keep it consistent
      // We update name, full_name and display_name to ensure the DB trigger catches it
      await supabase.auth.updateUser({
        data: { 
          name: newName.trim(),
          full_name: newName.trim(),
          display_name: newName.trim()
        }
      });
      
      // Force session refresh so other parts of the app see the metadata change
      await supabase.auth.refreshSession();

      setUserName(newName.trim());
      setIsEditingName(false);
      setSaveStatus("success");

      // Notify parent to refresh the name
      if (onProfileUpdate) onProfileUpdate();

      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      console.error("Save name error", e);
      setSaveStatus("error");
    }
  };

  const togglePriceUpdates = () => {
    const next = !priceUpdatesEnabled;
    setPriceUpdatesEnabled(next);
    localStorage.setItem("finrush_price_updates_enabled", next ? "true" : "false");
    // Notify other tabs/components via storage event
    window.dispatchEvent(new StorageEvent("storage", {
      key: "finrush_price_updates_enabled",
      newValue: next ? "true" : "false",
    }));
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    setDeleteStatus("pending");
    try {
      const { createClient } = await import("@/lib/supabase");
      const supabase = createClient();

      const executeAfter = new Date();
      executeAfter.setDate(executeAfter.getDate() + 30);

      const { error } = await supabase
        .from("account_deletion_requests")
        .insert({
          user_id: userId,
          execute_after: executeAfter.toISOString(),
          status: "pending",
        });

      if (error) throw error;

      setDeleteStatus("success");
      setTimeout(() => onSignOut(), 3000);
    } catch (e) {
      console.error("Delete account error", e);
      setDeleteStatus("error");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              className="absolute inset-0 pointer-events-auto"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className="glass-dialog relative z-[70] w-full max-w-[400px] max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
              <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--glass-border)" }}>
                <span className="text-[14px] font-bold text-foreground">
                  {t("settings.title")}
                </span>
                <motion.button
                  onClick={onClose}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </motion.button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                {!showConfirmDelete ? (
                  <div className="space-y-4">
                    {/* User Profile Section */}
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] uppercase tracking-wider font-semibold opacity-50 text-foreground text-left">
                        {t("settings.profileTitle")}
                      </p>

                      {/* Email Display (Read-only) */}
                      <div className="flex flex-col gap-1 py-1 text-left">
                        <span className="text-[10px] opacity-50 text-muted-foreground">{t("settings.emailLabel")}</span>
                        <span className="text-[13px] text-foreground opacity-80">{email || "..."}</span>
                      </div>

                      {/* Name Edit */}
                      <div className="flex flex-col gap-1 py-1 text-left">
                        <span className="text-[10px] opacity-50 text-muted-foreground">{t("settings.nameLabel")}</span>
                        {isEditingName ? (
                          <div className="flex gap-2 items-center mt-1">
                            <input
                              type="text"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[13px] text-foreground focus:outline-none focus:border-primary/50"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                            />
                            <button
                              onClick={handleSaveName}
                              disabled={saveStatus === "saving"}
                              className="bg-primary/20 hover:bg-primary/30 text-primary p-1.5 rounded-lg transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </button>
                            <button
                              onClick={() => { setIsEditingName(false); setNewName(userName); }}
                              className="bg-white/5 hover:bg-white/10 text-foreground p-1.5 rounded-lg transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center mt-1 group cursor-pointer" onClick={() => setIsEditingName(true)}>
                            <span className="text-[13px] text-foreground">{userName || (isLoadingProfile ? t("settings.nameLoading") : t("settings.nameEmpty"))}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="opacity-0 group-hover:opacity-50 transition-opacity">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
                            </svg>
                          </div>
                        )}
                        {saveStatus === "error" && <p className="text-[10px] text-red-400 mt-1">{t("settings.nameError")}</p>}
                        {saveStatus === "success" && <p className="text-[10px] text-primary mt-1">{t("settings.nameSuccess")}</p>}
                      </div>
                    </div>

                    <div className="border-t border-white/5" />

                    {/* Investments section */}
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] uppercase tracking-wider font-semibold opacity-50 text-foreground">
                        {t("settings.investments")}
                      </p>
                      <div className="flex items-center justify-between w-full py-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] text-foreground">
                            {t("settings.priceUpdates")}
                          </span>
                          <span className="text-[10px] opacity-50 text-muted-foreground">
                            {t("settings.priceUpdatesDesc")}
                          </span>
                        </div>
                        <button
                          onClick={togglePriceUpdates}
                          className="relative ml-4 w-10 h-6 rounded-full transition-colors duration-200 shrink-0"
                          style={{ background: priceUpdatesEnabled ? "var(--primary)" : "rgba(255,255,255,0.15)" }}
                          aria-label={priceUpdatesEnabled ? "Disable automatic price updates" : "Enable automatic price updates"}
                        >
                          <span
                            className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                            style={{ left: priceUpdatesEnabled ? "calc(100% - 20px)" : "4px" }}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-white/5" />

                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] uppercase tracking-wider font-semibold opacity-50 text-foreground">
                        {t("settings.account")}
                      </p>
                      <button
                        className="flex items-center justify-between w-full py-2 group text-left opacity-60 cursor-not-allowed"
                        disabled
                      >
                        <span className="text-[13px] text-foreground group-hover:text-foreground transition-colors">
                          {t("settings.backupData")}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-foreground opacity-50">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                      <button
                        className="flex items-center justify-between w-full py-2 group text-left opacity-60 cursor-not-allowed"
                        disabled
                      >
                        <span className="text-[13px] text-foreground group-hover:text-foreground transition-colors">
                          {t("settings.importData")}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-foreground opacity-50">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                      <div className="border-t border-white/5 my-2" />
                      <button
                        onClick={() => setShowConfirmDelete(true)}
                        className="flex items-center justify-between w-full py-2 group text-left"
                      >
                        <span className="text-[13px] text-red-400 group-hover:text-red-300 transition-colors">
                          {t("settings.deleteAccount")}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-red-400 opacity-50 group-hover:opacity-100">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-3">
                      <div className="flex gap-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" className="shrink-0 mt-0.5">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                        </svg>
                        <p className="text-[11px] leading-relaxed opacity-60 text-left text-foreground">
                          {t("settings.privacy")}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" className="shrink-0 mt-0.5">
                          <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        <p className="text-[11px] leading-relaxed opacity-60 text-left text-foreground">
                          {t("settings.voiceNote")}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" className="shrink-0 mt-0.5">
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                        <p className="text-[11px] leading-relaxed opacity-60 text-left text-foreground">
                          {t("settings.historyExpiry")}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-center">
                      <button
                        onClick={onSignOut}
                        className="btn-glass px-6 py-2 text-[12px] font-bold text-foreground"
                      >
                        {t("settings.logOut")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-2">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-expense)" strokeWidth="2">
                        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </div>
                    <h3
                      className="text-[15px] font-bold"
                      style={{ color: deleteStatus === "success" ? "var(--primary)" : "var(--foreground)" }}
                    >
                      {deleteStatus === "success"
                        ? t("settings.deleteSuccessHeading")
                        : t("settings.deleteConfirmHeading")}
                    </h3>
                    <p className="text-[12px] opacity-70 leading-relaxed text-muted-foreground">
                      {deleteStatus === "success"
                        ? t("settings.deleteSuccessBody")
                        : t("settings.deleteConfirmBody")}
                    </p>

                    {deleteStatus === "idle" && (
                      <div className="flex flex-col gap-2 pt-2">
                        <button
                          onClick={handleDeleteAccount}
                          className="w-full py-2.5 rounded-xl text-[13px] font-bold transition-all bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20"
                        >
                          {t("settings.deleteConfirmButton")}
                        </button>
                        <button
                          onClick={() => setShowConfirmDelete(false)}
                          className="w-full py-2.5 rounded-xl text-[13px] font-bold opacity-60 hover:opacity-100 transition-opacity text-foreground"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    )}

                    {deleteStatus === "pending" && (
                      <div className="py-4 flex flex-col items-center gap-3">
                        <div className="h-6 w-6 rounded-full border-t-2 border-red-500 animate-spin" />
                        <span className="text-[12px] text-muted-foreground">{t("common.processing")}</span>
                      </div>
                    )}

                    {deleteStatus === "error" && (
                      <div className="py-2">
                        <p className="text-[12px] text-red-400 mb-4">{t("settings.deleteError")}</p>
                        <button onClick={() => setDeleteStatus("idle")} className="text-[13px] underline text-foreground">
                          {t("common.goBack")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
