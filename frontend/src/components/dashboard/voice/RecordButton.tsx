"use client";

import { motion } from "framer-motion";

type AgentState = "idle" | "recording" | "thinking" | "error";

interface RecordButtonProps {
  agentState: AgentState;
  onToggle: () => void;
  timerProgress: number; // 1.0 = full, 0.0 = empty (15s elapsed)
  isProcessing: boolean;
  isConnecting: boolean;
  micPermission?: PermissionState;
}

export default function RecordButton({
  agentState,
  onToggle,
  timerProgress,
  isProcessing,
  isConnecting,
  micPermission,
}: RecordButtonProps) {
  const isDenied = micPermission === "denied";
  const isRecording = agentState === "recording" && !isDenied;
  const isThinking = agentState === "thinking" && !isDenied;
  const isError = agentState === "error" || isDenied;
  const isIdle = agentState === "idle" && !isDenied;
  const isSessionActive = isRecording;
  const isDisabled = isProcessing || isDenied;

  const isActive = isConnecting || isProcessing || isThinking;

  // Determine button CSS class based on state
  const btnClass = isActive
    ? "record-btn-connecting"
    : isRecording
      ? "record-btn-recording"
      : isError
        ? "record-btn-error"
        : "record-btn-idle";

  // SVG arc parameters — outer ring around the 72px button
  const ARC_R = 42;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>

      {/* Circular countdown arc */}
      {isSessionActive && (
        <svg
          viewBox="0 0 92 92"
          style={{
            position: "absolute",
            inset: -10,
            width: 92,
            height: 92,
            transform: "rotate(-90deg)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <circle
            cx={46} cy={46} r={ARC_R}
            fill="none"
            stroke="var(--voice-arc-track)"
            strokeWidth={2.5}
          />
          <motion.circle
            cx={46} cy={46} r={ARC_R}
            fill="none"
            stroke={timerProgress > 0.2 ? "var(--voice-arc-active)" : "var(--voice-arc-warning)"}
            strokeWidth={2.5}
            strokeLinecap="round"
            pathLength={1}
            animate={{ pathLength: timerProgress }}
            transition={{ duration: 0.4, ease: "linear" }}
          />
        </svg>
      )}

      {/* Pulse rings (while session active) */}
      {isSessionActive && (
        <>
          <motion.div
            className="absolute rounded-full"
            style={{ inset: -8, border: "1.5px solid var(--voice-pulse-outer)" }}
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{ inset: -8, border: "1.5px solid var(--voice-pulse-inner)" }}
            animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
            transition={{ duration: 1.2, delay: 0.3, repeat: Infinity, ease: "easeOut" }}
          />
        </>
      )}

      {/* Main button */}
      <motion.button
        className={`btn-round record-btn ${btnClass} flex items-center justify-center relative overflow-hidden`}
        animate={{ scale: isRecording ? 0.96 : 1 }}
        whileHover={{ scale: isDisabled ? 1 : (isRecording ? 1.02 : 1.08) }}
        whileTap={{ scale: isDisabled ? 1 : 0.92 }}
        transition={{ duration: 0.15 }}


        onClick={onToggle}
        disabled={isDisabled}
        style={{ pointerEvents: isDisabled ? "none" : "auto" }}
      >
        {/* Shine overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)",
            borderRadius: "inherit",
          }}
        />

        {(isIdle || isError) && (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
        {isRecording && (
          <div
            className="w-[20px] h-[20px] rounded-[5px]"
            style={{ background: "var(--background)", boxShadow: "0 0 10px rgba(0,0,0,0.4)" }}
          />
        )}
        {isThinking && (
          <motion.svg
            width="26" height="26" viewBox="0 0 24 24"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          >
            <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(10,26,15,0.7)" strokeWidth="2" strokeDasharray="14 40" strokeLinecap="round" />
          </motion.svg>
        )}
      </motion.button>
    </div>
  );
}
