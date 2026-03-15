"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAudioStream } from "@/hooks/useAudioStream";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { compressImage } from "@/lib/compressImage";
import OrbAnimation from "@/components/audio/OrbAnimation";
import DashboardCards from "@/components/dashboard/DashboardCards";
import { CurrencyProvider, useCurrency } from "@/contexts/CurrencyContext";
import { useLang } from "@/contexts/LangContext";

// Voice view sub-components (extracted from this file for maintainability)
import RecordButton from "@/components/dashboard/voice/RecordButton";
import SettingsPopup from "@/components/dashboard/voice/SettingsPopup";
import HistoryPopup from "@/components/dashboard/voice/HistoryPopup";
import { CurrencyButtonInner } from "@/components/dashboard/voice/CurrencyButton";
import ErrorOverlay from "@/components/dashboard/voice/ErrorOverlay";

export type AgentState = "idle" | "recording" | "thinking" | "error";
type ViewMode = "voice" | "dashboard";

export interface ChatMessage {
  id: number;
  role: "user" | "agent";
  text: string;
  type: "audio" | "text" | "image";
  timestamp: Date;
}

let msgIdCounter = 0;

function DashboardPageInner() {
  const { session, isLoading, signOut } = useAuth();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Force logout if user hasn't been active for more than 48h
  useEffect(() => {
    const lastActivity = localStorage.getItem("finrush_last_activity");
    const now = Date.now();
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

    if (lastActivity) {
      const diff = now - parseInt(lastActivity, 10);
      if (diff > FORTY_EIGHT_HOURS) {
        localStorage.setItem("finrush_last_activity", now.toString());
        signOut().then(() => {
          localStorage.removeItem("finrush_last_activity");
          window.location.reload();
        });
        return;
      }
    }
    localStorage.setItem("finrush_last_activity", now.toString());

    const interval = setInterval(() => {
      localStorage.setItem("finrush_last_activity", Date.now().toString());
    }, 60000);
    return () => clearInterval(interval);
  }, [signOut]);

  const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || "";
  const token = session?.access_token || null;

  const { lang, setLang, t } = useLang();
  const { currency } = useCurrency();

  const {
    transcripts,
    inputTranscripts,
    turnComplete,
    startRecording,
    stopRecording,
    sendImageData,
    sendTextMessage,
    mediaStreamRef,
    error: wsError,
    isRecording,
    isReadyToSend,
    isAgentSpeaking,
    refreshData,
  } = useAudioStream(wsBaseUrl, token, lang, currency);

  const audioLevelRef = useAudioLevel(mediaStreamRef.current);

  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [viewMode, setViewMode] = useState<ViewMode>("voice");
  const [textInput, setTextInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Persist messages (24h)
  useEffect(() => {
    const saved = localStorage.getItem("agent_messages");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const now = Date.now();
        const filtered = parsed
          .filter((m: ChatMessage) => now - new Date(m.timestamp).getTime() < 24 * 60 * 60 * 1000)
          .map((m: ChatMessage) => ({ ...m, timestamp: new Date(m.timestamp) }));
        if (filtered.length > 0) setMessages(filtered);
      } catch (err) {
        console.error("Error loading messages from localStorage:", err);
      }
    }
  }, []);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [profileUserName, setProfileUserName] = useState<string | null>(null);

  const fetchProfileName = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { createClient } = await import("@/lib/supabase");
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("id", session.user.id)
        .single();
      
      if (!error && data?.user_name) {
        setProfileUserName(data.user_name);
      }
    } catch (err) {
      console.error("Error fetching profile name:", err);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfileName();
    }
  }, [session?.user?.id, fetchProfileName]);

  const handleProfileUpdate = useCallback(async () => {
    const { createClient } = await import("@/lib/supabase");
    const supabase = createClient();
    await supabase.auth.refreshSession();
    await fetchProfileName();
  }, [fetchProfileName]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("agent_messages", JSON.stringify(messages));
    }
  }, [messages]);

  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [micPermission, setMicPermission] = useState<PermissionState>("prompt");
  const [activeError, setActiveError] = useState<
    "mic_denied" | "connection_lost" | "session_expired" | "agent_error" | "no_response" | "generic" | null
  >(null);

  const agentStateRef = useRef<AgentState>(agentState);
  useEffect(() => { agentStateRef.current = agentState; }, [agentState]);
  const lastActionTimeRef = useRef<number>(0);

  const isProcessingRef = useRef<boolean>(isProcessing);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  const isAgentSpeakingRef = useRef<boolean>(isAgentSpeaking);
  useEffect(() => { isAgentSpeakingRef.current = isAgentSpeaking; }, [isAgentSpeaking]);

  useEffect(() => {
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "microphone" as PermissionName }).then(res => {
        setMicPermission(res.state);
        res.onchange = () => setMicPermission(res.state);
      }).catch(() => { });
    }
  }, []);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const prevTranscriptLen = useRef(0);
  const prevInputTranscriptLen = useRef(0);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAgentTextRef = useRef<string[]>([]);
  const voiceSessionActiveRef = useRef(false);

  // 15-second inactivity session timer
  const [timerProgress, setTimerProgress] = useState(1);
  const sessionStartRef = useRef<number | null>(null);
  const timerRafRef = useRef<number | null>(null);
  const handleSessionTimeoutRef = useRef<() => void>(() => { });
  const lastActivityTimeRef = useRef<number>(Date.now());

  // Handle WebSocket errors
  useEffect(() => {
    if (!wsError) return;
    if (timerRafRef.current) { cancelAnimationFrame(timerRafRef.current); timerRafRef.current = null; }
    setAgentState("error");
    if (wsError?.includes("Session already active")) setActiveError("connection_lost");
    else if (wsError?.includes("Token expired")) setActiveError("session_expired");
    sessionStartRef.current = null;
    setTimerProgress(1);
    voiceSessionActiveRef.current = false;
    setMessages(prev => [...prev, { id: ++msgIdCounter, role: "agent", text: `Connection error: ${wsError}`, type: "text", timestamp: new Date() }]);
    setAgentState("idle");
  }, [wsError]);

  // Thinking timeout — 15s no response
  useEffect(() => {
    if (agentState === "thinking") {
      errorTimeoutRef.current = setTimeout(() => {
        pendingAgentTextRef.current = [];
        voiceSessionActiveRef.current = false;
        setAgentState("error");
        setMessages(prev => [...prev, { id: ++msgIdCounter, role: "agent", text: "No response from agent. Please try again.", type: "text", timestamp: new Date() }]);
        setTimeout(() => setAgentState("idle"), 3000);
      }, 15000);
    } else {
      if (errorTimeoutRef.current) { clearTimeout(errorTimeoutRef.current); errorTimeoutRef.current = null; }
    }
  }, [agentState]);

  // Accumulate agent text chunks
  useEffect(() => {
    if (transcripts.length > prevTranscriptLen.current) {
      const newChunks = transcripts.slice(prevTranscriptLen.current);
      pendingAgentTextRef.current.push(...newChunks);
      lastActivityTimeRef.current = Date.now();
    }
    prevTranscriptLen.current = transcripts.length;
  }, [transcripts]);

  // Commit accumulated text on turn complete
  useEffect(() => {
    if (turnComplete === 0) return;
    const text = pendingAgentTextRef.current.join(" ").trim();
    pendingAgentTextRef.current = [];
    if (text) {
      setMessages(prev => [...prev, { id: ++msgIdCounter, role: "agent" as const, text, type: "audio" as const, timestamp: new Date() }]);
    }
    if (isProcessing) {
      if (processingTimeoutRef.current) { clearTimeout(processingTimeoutRef.current); processingTimeoutRef.current = null; }
      setIsProcessing(false);
      setAgentState("idle");
    } else if (!voiceSessionActiveRef.current) {
      setAgentState("idle");
    } else {
      setAgentState("recording");
    }
  }, [turnComplete, isProcessing]);

  // User speech → message
  useEffect(() => {
    if (inputTranscripts.length > prevInputTranscriptLen.current) {
      const newChunks = inputTranscripts.slice(prevInputTranscriptLen.current);
      newChunks.forEach(text => {
        if (text.trim()) {
          setMessages(prev => [...prev, { id: ++msgIdCounter, role: "user" as const, text, type: "audio" as const, timestamp: new Date() }]);
        }
      });
      lastActivityTimeRef.current = Date.now();
    }
    prevInputTranscriptLen.current = inputTranscripts.length;
  }, [inputTranscripts]);

  // Session guard
  useEffect(() => {
    if (!isLoading && (!session || !session.access_token)) {
      Sentry.captureMessage("Dashboard: No session found, redirecting to login", { level: "info" });
      router.push("/login");
    }
  }, [session, isLoading, router]);

  // Cancel pending deletion on login
  useEffect(() => {
    if (session?.user?.id) {
      const cancelDeletion = async () => {
        const { createClient } = await import("@/lib/supabase");
        const supabase = createClient();
        const { data } = await supabase
          .from("account_deletion_requests")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("status", "pending");
        if (data && data.length > 0) {
          await supabase
            .from("account_deletion_requests")
            .update({ status: "canceled" })
            .eq("user_id", session.user.id)
            .eq("status", "pending");
          Sentry.captureMessage(`Account deletion request canceled for user ${session.user.id} due to login`, { level: "info" });
        }
      };
      cancelDeletion();
    }
  }, [session]);

  // Timer helpers
  const stopSessionTimer = useCallback(() => {
    if (timerRafRef.current) { cancelAnimationFrame(timerRafRef.current); timerRafRef.current = null; }
    sessionStartRef.current = null;
    setTimerProgress(1);
  }, []);

  const handleSessionTimeout = useCallback(() => {
    voiceSessionActiveRef.current = false;
    stopSessionTimer();
    stopRecording();
    setIsProcessing(true);
    processingTimeoutRef.current = setTimeout(() => {
      processingTimeoutRef.current = null;
      setIsProcessing(false);
      setAgentState("idle");
    }, 5000);
  }, [stopSessionTimer, stopRecording]);

  useEffect(() => { handleSessionTimeoutRef.current = handleSessionTimeout; }, [handleSessionTimeout]);

  const startSessionTimer = useCallback(() => {
    const now = Date.now();
    sessionStartRef.current = now;
    lastActivityTimeRef.current = now;
    setTimerProgress(1);

    const tick = () => {
      if (!sessionStartRef.current) return;
      const currentNow = Date.now();
      if (audioLevelRef.current > 0 || agentStateRef.current === "thinking" || isProcessingRef.current || isAgentSpeakingRef.current) {
        lastActivityTimeRef.current = currentNow;
      }
      const inactivityElapsed = currentNow - lastActivityTimeRef.current;
      if (inactivityElapsed > 15000) {
        setTimerProgress(0);
        handleSessionTimeoutRef.current();
        return;
      }
      setTimerProgress(Math.max(0, 1 - inactivityElapsed / 15000));
      timerRafRef.current = requestAnimationFrame(tick);
    };
    timerRafRef.current = requestAnimationFrame(tick);
  }, [audioLevelRef]);

  useEffect(() => {
    return () => {
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
    };
  }, []);

  // Voice toggle
  const handleVoiceToggle = useCallback(() => {
    if (agentState === "recording") {
      voiceSessionActiveRef.current = false;
      stopRecording();
      if (timerRafRef.current) { cancelAnimationFrame(timerRafRef.current); timerRafRef.current = null; }
      sessionStartRef.current = null;
      setTimerProgress(0);
      setIsProcessing(true);
      processingTimeoutRef.current = setTimeout(() => {
        processingTimeoutRef.current = null;
        setIsProcessing(false);
        setAgentState("idle");
      }, 5000);
    } else if (!isProcessing && (agentState === "idle" || agentState === "error")) {
      voiceSessionActiveRef.current = true;
      setAgentState("recording");
      startSessionTimer();
      startRecording().catch((err) => {
        console.error("Failed to start recording:", err);
        if (timerRafRef.current) { cancelAnimationFrame(timerRafRef.current); timerRafRef.current = null; }
        sessionStartRef.current = null;
        setTimerProgress(1);
        voiceSessionActiveRef.current = false;
        setAgentState("error");
        setActiveError(err.name === "NotAllowedError" || err.message?.includes("permission") ? "mic_denied" : "generic");
        setMessages(prev => [...prev, { id: ++msgIdCounter, role: "agent", text: "Failed to start recording. Please check mic permissions.", type: "text", timestamp: new Date() }]);
        setTimeout(() => { setAgentState(prev => prev === "error" ? "idle" : prev); }, 2000);
      });
    }
  }, [agentState, isProcessing, startRecording, stopRecording, startSessionTimer]);

  const handleTextSubmit = useCallback(() => {
    const text = textInput.trim();
    if (!text || agentState === "thinking") return;
    const now = Date.now();
    if (now - lastActionTimeRef.current < 2000) {
      setMessages(prev => [...prev, { id: ++msgIdCounter, role: "agent", text: "Please wait a moment before sending another message.", type: "text", timestamp: new Date() }]);
      return;
    }
    lastActionTimeRef.current = now;
    setTextInput("");
    setMessages(prev => [...prev, { id: ++msgIdCounter, role: "user", text, type: "text", timestamp: new Date() }]);
    setAgentState("thinking");
    try {
      sendTextMessage(text);
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "handleTextSubmit" } });
      setAgentState("error");
    }
  }, [textInput, sendTextMessage, agentState]);

  const isConnecting = !isProcessing && agentState === "recording" && (!isReadyToSend() || !isRecording);

  // Connection timeout (45s — long enough to survive lang/currency reconnects)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isConnecting) {
      timeoutId = setTimeout(() => {
        Sentry.captureMessage("Dashboard: Connection timeout reached (45s)", { level: "warning", tags: { component: "DashboardPage", action: "connectionTimeout" } });
        if (timerRafRef.current) { cancelAnimationFrame(timerRafRef.current); timerRafRef.current = null; }
        sessionStartRef.current = null;
        setTimerProgress(1);
        voiceSessionActiveRef.current = false;
        stopRecording();
        setAgentState("error");
        setMessages(prev => [...prev, { id: ++msgIdCounter, role: "agent", text: t("voice.connectionTimeout"), type: "text", timestamp: new Date() }]);
        setActiveError("connection_lost");
        setTimeout(() => { setAgentState(prev => prev === "error" ? "idle" : prev); }, 2000);
      }, 45000);
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [agentState, isProcessing, isRecording, isReadyToSend, stopRecording, isConnecting, t]);

  const handleImageSelect = useCallback(async (file: File) => {
    // 2.8MB in binary ensures Base64 payload (<4MB limit) is never exceeded in backend
    const MAX_FILE_SIZE = 2.8 * 1024 * 1024;

    // Whitelist allowed MIME types
    const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    const isPdf = file.type === "application/pdf";
    const isAllowedImage = ALLOWED_IMAGE_TYPES.has(file.type);

    // Strict validation: only images and PDFs
    if (!isAllowedImage && !isPdf) {
      setMessages(prev => [...prev, {
        id: ++msgIdCounter,
        role: "agent",
        text: `File type not supported. Please use: JPG, PNG, WebP, GIF, or PDF.`,
        type: "text",
        timestamp: new Date()
      }]);
      return;
    }

    // PDF validation: reject if too large (no compression available)
    if (isPdf && file.size > MAX_FILE_SIZE) {
      setMessages(prev => [...prev, {
        id: ++msgIdCounter,
        role: "agent",
        text: "PDF too large (max 5 MB). Please select a smaller file.",
        type: "text",
        timestamp: new Date()
      }]);
      return;
    }

    const now = Date.now();
    if (now - lastActionTimeRef.current < 3000) {
      setMessages(prev => [...prev, {
        id: ++msgIdCounter,
        role: "agent",
        text: "Please wait a moment before sending another file.",
        type: "text",
        timestamp: new Date()
      }]);
      return;
    }
    lastActionTimeRef.current = now;

    try {
      setMessages(prev => [...prev, {
        id: ++msgIdCounter,
        role: "user",
        text: isPdf ? `PDF: ${file.name}` : `Image: ${file.name}`,
        type: "image",
        timestamp: new Date()
      }]);

      if (isPdf) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        sendImageData(base64, "application/pdf");
      } else {
        // Compress image first, then validate after compression
        const { base64, mimeType } = await compressImage(file, MAX_FILE_SIZE);

        // Estimate compressed size from base64 (base64 is ~33% larger than binary)
        const compressedSizeBytes = Math.ceil((base64.length * 3) / 4);

        if (compressedSizeBytes > MAX_FILE_SIZE) {
          // Fallback: ultra-aggressive compression still too large
          setMessages(prev => [...prev, {
            id: ++msgIdCounter,
            role: "agent",
            text: "Image couldn't be compressed enough. Please use a smaller or lower-resolution image.",
            type: "text",
            timestamp: new Date()
          }]);
          return;
        }

        sendImageData(base64, mimeType);
      }
      setAgentState("thinking");
    } catch (err) {
      console.error("Failed to process file", err);
      Sentry.captureException(err, { tags: { component: "handleImageSelect" } });
      setMessages(prev => [...prev, {
        id: ++msgIdCounter,
        role: "agent",
        text: "Failed to process file. Please try again.",
        type: "text",
        timestamp: new Date()
      }]);
      setAgentState("idle");
    }
  }, [sendImageData]);

  const isActive = agentState === "thinking" || agentState === "error";

  const displayState = isProcessing ? "processing"
    : agentState === "thinking" ? "processing"
      : agentState === "recording" && (!isReadyToSend() || !isRecording) ? "connecting"
        : agentState === "recording" ? "recording"
          : agentState === "error" ? "error"
            : "idle";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-t-2 border-r-2 border-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-background" style={{ touchAction: "none", overscrollBehavior: "none" }}>

      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--voice-glow)" }} />

      {/* WebSocket error banner */}
      {wsError && (
        <div className="voice-ws-error absolute top-4 left-1/2 -translate-x-1/2 z-[80] px-4 py-2 rounded-xl flex items-center gap-3 w-max max-w-[calc(100vw-2rem)]">
          <p className="text-[11px] font-medium">
            {wsError.includes("Session already active")
              ? t("voice.sessionActiveOtherTab")
              : wsError.includes("Token expired")
                ? t("voice.tokenExpired")
                : t("voice.connectionIssue")}
          </p>
          <button
            onClick={() => { Sentry.captureMessage(`WebSocket Error reported by user: ${wsError}`, { level: "warning" }); window.location.reload(); }}
            className="text-[10px] underline font-bold whitespace-nowrap opacity-80 hover:opacity-100 transition-opacity"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* Mic denied banner */}
      {micPermission === "denied" && viewMode === "voice" && (
        <div className="voice-mic-denied absolute top-20 left-1/2 -translate-x-1/2 z-[80] px-6 py-3 rounded-2xl flex flex-col gap-1 items-center max-w-[320px] text-center">
          <p className="text-[13px] font-bold">{t("errors.mic_denied.title")}</p>
          <p className="text-[11px] opacity-80">{t("errors.mic_denied.desc")}</p>
        </div>
      )}

      {/* ═══ VOICE VIEW ═══ */}
      <div
        className="absolute inset-0 flex flex-col transition-opacity duration-300"
        style={{
          opacity: viewMode === "voice" ? 1 : 0,
          pointerEvents: viewMode === "voice" ? "auto" : "none",
          zIndex: viewMode === "voice" ? 10 : 1,
          touchAction: "none",
        }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 z-10">
          <motion.button
            className="voice-bar-btn rounded-full"
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => setViewMode("dashboard")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </motion.button>
          <motion.button
            className="voice-bar-btn-sm rounded-full"
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={signOut}
            title={t("settings.logOut")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </motion.button>
        </div>

        {/* Greeting + heading */}
        <AnimatePresence>
          {!isActive && (
            <motion.div
              className="flex flex-col items-center px-8 pt-8 sm:pt-10 z-10"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
            >
              <p className="text-[11px] font-medium tracking-wide uppercase mb-1 text-muted-foreground opacity-50">
                {t("voice.greeting", { 
                  name: profileUserName || session?.user?.user_metadata?.name || session?.user?.email?.split("@")[0] || (lang === "es" ? "usuario" : "there") 
                })}
              </p>
              <h1 className="text-[28px] sm:text-[34px] font-bold text-center leading-tight text-foreground whitespace-pre-wrap">
                {t("voice.heading")}
              </h1>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orb */}
        <div className="flex-1 flex items-center justify-center relative">
          <OrbAnimation
            agentState={agentState}
            audioLevel={audioLevelRef}
            size={300}
            isProcessing={isProcessing}
            isActive={viewMode === "voice"}
          />
        </div>

        {/* State label */}
        <AnimatePresence mode="wait">
          <motion.div
            key={displayState}
            className="flex justify-center pb-3"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}
          >
            {micPermission === "denied" && (
              <div className="voice-badge voice-badge-error">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{t("voice.micDenied")}</span>
              </div>
            )}
            {micPermission !== "denied" && agentState === "recording" && (!isReadyToSend() || !isRecording) && !isProcessing && (
              <div className="voice-badge voice-badge-connecting">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="10 18" strokeLinecap="round" />
                  </svg>
                </motion.div>
                <span>{t("voice.connecting")}</span>
              </div>
            )}
            {micPermission !== "denied" && agentState === "recording" && isReadyToSend() && isRecording && !isProcessing && (
              <div className="voice-badge voice-badge-recording">
                <motion.div className="w-2 h-2 rounded-full bg-primary" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }} />
                <span>{t("voice.recording")}</span>
              </div>
            )}
            {micPermission !== "denied" && isProcessing && (
              <div className="voice-badge voice-badge-processing">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="10 18" strokeLinecap="round" />
                  </svg>
                </motion.div>
                <span>{t("voice.processing")}</span>
              </div>
            )}
            {micPermission !== "denied" && agentState === "thinking" && !isProcessing && (
              <div className="voice-badge voice-badge-thinking">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="10 18" strokeLinecap="round" />
                  </svg>
                </motion.div>
                <span>{t("voice.thinking")}</span>
              </div>
            )}
            {micPermission !== "denied" && agentState === "error" && !isProcessing && (
              <div className="voice-badge voice-badge-error">
                <motion.div className="w-2 h-2 rounded-full bg-current" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.5, repeat: Infinity }} />
                <span>{t("voice.noResponse")}</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Text input bar */}
        <AnimatePresence>
          {!isActive && (
            <motion.div
              className="mx-6 mb-4 sm:mx-auto sm:w-full sm:max-w-md"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.25 }}
            >
              <form onSubmit={(e) => { e.preventDefault(); handleTextSubmit(); }} className="voice-input-bar">
                <input
                  className="flex-1 bg-transparent text-[13px] outline-none text-foreground placeholder:text-muted-foreground/50"
                  placeholder={t("voice.placeholder")}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                />
                {textInput.trim() ? (
                  <motion.button type="submit" whileTap={{ scale: 0.9 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </motion.button>
                ) : (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[0.4, 0.7, 1, 0.7, 0.4].map((h, i) => (
                      <motion.div
                        key={i}
                        className="w-[2.5px] rounded-full"
                        style={{ height: 10 * h, background: "var(--muted-foreground)", opacity: 0.4 }}
                        animate={{ height: [10 * h, 10 * h * 1.5, 10 * h] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                      />
                    ))}
                  </div>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-28 shrink-0" />
      </div>

      {/* ═══ DASHBOARD VIEW ═══ */}
      <div
        className="absolute inset-0 flex flex-col transition-opacity duration-300"
        style={{
          opacity: viewMode === "dashboard" ? 1 : 0,
          pointerEvents: viewMode === "dashboard" ? "auto" : "none",
          zIndex: viewMode === "dashboard" ? 10 : 1,
          touchAction: viewMode === "dashboard" ? "auto" : "none",
        }}
      >
        <div className="pt-4 sm:pt-6 px-4 pb-2 flex items-center justify-between z-10 shrink-0">
          <Link href="/" className="flex items-center">
            <Image src="/logo/finrush_logo_text.svg" alt="Finrush" width={130} height={32} priority />
          </Link>
          <div className="flex items-center gap-2">
            <motion.button
              className="voice-bar-btn rounded-full hover:bg-white/10 transition-colors"
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              onClick={() => setSettingsOpen(true)}
              title={t("settings.title")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </motion.button>
            <motion.button
              className="voice-bar-btn rounded-full transition-colors"
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              onClick={() => setViewMode("voice")}
              title={t("voice.backToAgent")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </motion.button>
          </div>
        </div>
        <DashboardCards session={session} refreshData={refreshData} />
      </div>

      {/* ═══ HISTORY POPUP ═══ */}
      <HistoryPopup open={historyOpen} onClose={() => setHistoryOpen(false)} messages={messages} />

      {/* ═══ SETTINGS POPUP ═══ */}
      <SettingsPopup 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        onSignOut={signOut} 
        userId={session?.user?.id}
        onProfileUpdate={handleProfileUpdate}
      />

      {/* ═══ FLOATING BOTTOM BAR ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div style={{ height: 100, background: "linear-gradient(to top, var(--background) 50%, transparent)" }} />
        <div className="flex items-center justify-center gap-4 -mt-[60px] pb-8 sm:pb-10 pointer-events-auto bg-background">

          {/* Currency cycle */}
          <CurrencyButtonInner />

          {/* History */}
          <motion.button
            className="voice-action-btn rounded-full"
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => setHistoryOpen(!historyOpen)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </motion.button>

          {/* Record */}
          <RecordButton
            agentState={agentState}
            onToggle={handleVoiceToggle}
            timerProgress={timerProgress}
            isProcessing={isProcessing}
            isConnecting={isConnecting}
            micPermission={micPermission}
          />

          {/* Camera */}
          <motion.button
            className="voice-action-btn rounded-full"
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => cameraInputRef.current?.click()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
            </svg>
          </motion.button>

          {/* Language toggle */}
          <motion.button
            className="voice-action-btn rounded-full"
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            title={t("language.switchTo")}
          >
            <span className="text-[11px] font-black leading-none text-muted-foreground">
              {lang.toUpperCase()}
            </span>
          </motion.button>

          {/* Hidden file input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) handleImageSelect(file);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      {/* ═══ ERROR OVERLAY ═══ */}
      <ErrorOverlay
        type={activeError}
        onClose={() => setActiveError(null)}
        onRetry={activeError === "connection_lost" ? () => window.location.reload() : undefined}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <CurrencyProvider>
      <DashboardPageInner />
    </CurrencyProvider>
  );
}
