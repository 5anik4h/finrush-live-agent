"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!consent) setIsVisible(true);
  }, []);

  if (!isVisible) return null;

  const acceptCookies = () => {
    localStorage.setItem("cookie_consent", "true");
    setIsVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-[#0A1A0F] border-t border-white/10 text-white shadow-2xl animate-in slide-in-from-bottom-full duration-500">
      <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-400">
          We use cookies to improve your experience. By continuing to use Finrush, you agree to our use of cookies according to our{" "}
          <Link href="/cookies" className="text-[#C8FF00] hover:underline hover:text-white transition-colors">
            Cookie Policy
          </Link>.
        </p>
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={acceptCookies}
            className="px-6 py-2 bg-[#C8FF00] text-[#050E08] font-semibold text-sm rounded-full hover:bg-white transition-colors"
          >
            Got it
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
