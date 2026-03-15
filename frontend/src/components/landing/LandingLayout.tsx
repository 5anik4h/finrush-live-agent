"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import React from "react";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const ctaHref = session ? "/dashboard" : "/login";
  const ctaText = session ? "Dashboard" : "Sign In";

  return (
    <div className="min-h-screen bg-[#0A1A0F] text-white selection:bg-[#C8FF00]/30 selection:text-white overflow-x-hidden font-sans relative flex flex-col">
      {/* Animated gradient background — fluids glowing orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-40%] left-[-20%] w-[800px] h-[800px] rounded-full opacity-30 animate-float-slow" style={{ background: "radial-gradient(circle, rgba(124,198,126,0.4), transparent 70%)", filter: "blur(120px)" }}></div>
        <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-25 animate-float-medium" style={{ background: "radial-gradient(circle, rgba(200,255,0,0.3), transparent 70%)", filter: "blur(100px)" }}></div>
        <div className="absolute bottom-[-20%] left-[30%] w-[500px] h-[500px] rounded-full opacity-20 animate-float-slower" style={{ background: "radial-gradient(circle, rgba(179,136,255,0.15), transparent 70%)", filter: "blur(90px)" }}></div>
      </div>

      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6 relative z-10 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center">
          <Image src="/logo/finrush_logo_text.svg" alt="Finrush" width={140} height={35} priority />
        </Link>
        <Link
          href={ctaHref}
          className="hidden md:inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-white bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors backdrop-blur-md"
        >
          {ctaText}
        </Link>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#050E08]/80 backdrop-blur-lg shrink-0 mt-auto">
        <div className="container mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center opacity-80">
            <Image src="/logo/finrush_logo_text.svg" alt="Finrush" width={110} height={28} />
          </div>
          <div className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Finrush. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link>
          </div>
        </div>
      </footer>

      {/* Global simple animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
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
        .animate-float-slow {
          animation: float-slow 12s ease-in-out infinite;
        }
        .animate-float-medium {
          animation: float-medium 14s ease-in-out infinite;
        }
        .animate-float-slower {
          animation: float-slower 16s ease-in-out infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
      `}} />
    </div>
  );
}
