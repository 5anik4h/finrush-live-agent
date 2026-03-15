"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase";
import { useLang } from "@/contexts/LangContext";

/* ═══════════════════════════════════════════════
   PALETTE — matching voice agent dark blue theme
   ═══════════════════════════════════════════════ */
const P = {
  bg: "#0A1A0F",
  lime: "#C8FF00",
  limeLight: "#D4FF4A",
  purple: "#B388FF",
  purpleLight: "#D4AAFF",
  teal: "#4CAF50",
  muted: "#3D5C42",
  textPri: "#F0F5F1",
  textSec: "rgba(240,245,241,0.60)",
  textDim: "rgba(240,245,241,0.35)",
  border: "rgba(255,255,255,0.12)",
};

/* ═══════════════════════════════════════════════
   AURORA BACKGROUND — subtle animated gradient
   Canvas-based for smooth color transitions
   ═══════════════════════════════════════════════ */
function AuroraBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-40%] left-[-20%] w-[800px] h-[800px] rounded-full opacity-30" style={{ background: "radial-gradient(circle, rgba(124,198,126,0.4), transparent 70%)", filter: "blur(120px)", animation: "float-slow 12s ease-in-out infinite" }}></div>
      <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-25" style={{ background: "radial-gradient(circle, rgba(200,255,0,0.3), transparent 70%)", filter: "blur(100px)", animation: "float-medium 14s ease-in-out infinite" }}></div>
      <div className="absolute bottom-[-20%] left-[30%] w-[500px] h-[500px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, rgba(179,136,255,0.15), transparent 70%)", filter: "blur(90px)", animation: "float-slower 16s ease-in-out infinite" }}></div>
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 20px) rotate(0deg); }
          50% { transform: translate(30px, -20px) rotate(180deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-40px, 30px) rotate(-180deg); }
        }
        @keyframes float-slower {
          0%, 100% { transform: translate(0, -30px) rotate(0deg); }
          50% { transform: translate(50px, 20px) rotate(180deg); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LOGIN PAGE
   ═══════════════════════════════════════════════ */
export default function LoginPage() {
  const { session, isLoading } = useAuth();
  const { lang } = useLang();
  const router = useRouter();
  const supabase = createClient();

  const [focused, setFocused] = useState<"name" | "email" | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isLoading && session) {
      router.push("/dashboard");
    }
  }, [session, isLoading, router]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage("Please enter your email");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/auth/callback" : "",
          data: {
            full_name: name || "User",
            language: lang
          }
        }
      });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Check your email for a magic link!");
        setEmail("");
      }
    } catch {
      setMessage("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: P.bg }}>
        <div className="h-8 w-8 rounded-full border-t-2 border-r-2" style={{ borderColor: P.lime, animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center overflow-hidden relative"
      style={{ background: P.bg }}>

      {/* Aurora animated background */}
      <AuroraBackground />

      {/* Card container */}
      <motion.div
        className="relative z-10 w-full max-w-[380px] mx-4 flex flex-col items-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Logo — Fin + rush text */}
        <div className="flex flex-col items-center gap-4 mb-10">
          <Link href="/" className="flex flex-col items-center gap-1.5 cursor-pointer">
            <Image src="/logo/finrush_logo_text.svg" alt="Finrush" width={140} height={35} priority />
            <p className="text-[13px]" style={{ color: P.textSec }}>
              Financial Autopilot for the Modern Life
            </p>
          </Link>
        </div>

        {/* Glass form card — semi-transparent dark, like text_voice_agent input bar */}
        <motion.form
          className="w-full rounded-[24px] p-7 flex flex-col gap-5"
          style={{
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(24px)",
            border: `1px solid ${P.border}`,
            boxShadow: "0 8px 48px rgba(0,0,0,0.4), 0 0 1px rgba(200,255,0,0.08)",
          }}
          onSubmit={handleMagicLink}
        >
          <div>
            <h2 className="text-[20px] font-bold" style={{ color: P.textPri }}>
              Welcome
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: P.textSec }}>
              Sign in with a magic link — no password needed.
            </p>
          </div>

          {/* Name field — semi-transparent matching reference */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: P.textDim }}>
              Name
            </label>
            <motion.div
              className="flex items-center gap-3 h-[48px] rounded-[14px] px-4"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1.5px solid ${focused === "name" ? P.lime : "rgba(255,255,255,0.12)"}`,
                boxShadow: focused === "name" ? `0 0 0 3px rgba(200,255,0,0.08)` : "none",
                transition: "all 0.25s",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={focused === "name" ? P.limeLight : P.textDim}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: "stroke 0.25s" }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                className="flex-1 bg-transparent text-[14px] outline-none"
                style={{ color: P.textPri }}
                placeholder="Your name or alias"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocused("name")}
                onBlur={() => setFocused(null)}
              />
            </motion.div>
          </div>

          {/* Email field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: P.textDim }}>
              Email
            </label>
            <motion.div
              className="flex items-center gap-3 h-[48px] rounded-[14px] px-4"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1.5px solid ${focused === "email" ? P.lime : "rgba(255,255,255,0.12)"}`,
                boxShadow: focused === "email" ? `0 0 0 3px rgba(200,255,0,0.08)` : "none",
                transition: "all 0.25s",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={focused === "email" ? P.limeLight : P.textDim}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: "stroke 0.25s" }}>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <input
                className="flex-1 bg-transparent text-[14px] outline-none"
                style={{ color: P.textPri }}
                placeholder="Your email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
              />
            </motion.div>
          </div>

          {/* Message feedback */}
          {message && (
            <div className="text-[12px] px-3 py-2 rounded-lg" style={{ color: P.textSec, background: "rgba(200,255,0,0.08)" }}>
              {message}
            </div>
          )}

          {/* CTA — Send Magic Link */}
          <motion.button
            type="submit"
            disabled={loading}
            className="w-full h-[50px] rounded-full font-bold text-[14px] flex items-center justify-center gap-2 relative overflow-hidden mt-1 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #8BC34A, #C8FF00)",
              boxShadow: "0 4px 24px rgba(200,255,0,0.30)",
              color: "#0A1A0F",
            }}
            onHoverStart={() => !loading && setHoveredBtn(true)}
            onHoverEnd={() => setHoveredBtn(false)}
            whileHover={!loading ? { scale: 1.01, boxShadow: "0 6px 32px rgba(200,255,0,0.40)" } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
          >
            <AnimatePresence>
              {hoveredBtn && !loading && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}
                  initial={{ x: "-100%" }}
                  animate={{ x: "200%" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeInOut" }}
                />
              )}
            </AnimatePresence>
            {!loading && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4z" />
                <path d="M22 2 11 13" />
              </svg>
            )}
            <span>{loading ? "Sending..." : "Send Magic Link"}</span>
          </motion.button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: P.border }} />
            <span className="text-[11px] font-medium" style={{ color: P.textDim }}>or continue with</span>
            <div className="flex-1 h-px" style={{ background: P.border }} />
          </div>

          {/* Google OAuth */}
          <motion.button
            type="button"
            className="w-full h-[48px] rounded-[14px] flex items-center justify-center gap-3 text-[13px] font-semibold relative overflow-hidden"
            style={{
              color: P.textPri,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${P.border}`,
            }}
            whileHover={{ scale: 1.01, borderColor: "rgba(255,255,255,0.20)" }}
            whileTap={{ scale: 0.98 }}
            onClick={async () => {
              const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.origin + "/auth/callback" }
              });
              if (error) setMessage(error.message);
            }}
          >
            {/* Google logo */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>Continue with Google</span>
          </motion.button>
        </motion.form>

        {/* Security badge */}
        <motion.div
          className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-medium"
          style={{ color: P.textDim, background: "rgba(255,255,255,0.03)", border: `1px solid ${P.border}` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={P.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Secure & encrypted access</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
