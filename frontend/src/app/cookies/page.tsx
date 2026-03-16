import LandingLayout from "@/components/landing/LandingLayout";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CookiePolicy() {
  return (
    <LandingLayout>
      <div className="container mx-auto max-w-4xl pt-12 p-6">
        <Link href="/" className="inline-flex items-center gap-2 text-[#C8FF00] mb-8 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <h1 className="text-4xl font-bold mb-8">Cookie Policy</h1>

        <div className="prose prose-invert max-w-none text-gray-300 space-y-6">
          <p><strong>Last Updated:</strong> 03-16-2026</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. What Are Cookies</h2>
          <p>As is common practice with almost all professional websites, this site uses cookies, which are tiny files that are downloaded to your computer, to improve your experience. This page describes what information they gather, how we use it and why we sometimes need to store these cookies.</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. How We Use Cookies</h2>
          <p>We use cookies for a variety of reasons detailed below. Unfortunately, in most cases, there are no industry standard options for disabling cookies without completely disabling the functionality and features they add to this site.</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. The Cookies We Set</h2>
          <div className="overflow-x-auto my-4">
            <table className="min-w-full bg-white/5 border border-white/10 text-left">
              <thead>
                <tr>
                  <th className="px-4 py-3 border-b border-white/10 font-semibold text-[#C8FF00]">Cookie Name</th>
                  <th className="px-4 py-3 border-b border-white/10 font-semibold text-[#C8FF00]">Purpose</th>
                  <th className="px-4 py-3 border-b border-white/10 font-semibold text-[#C8FF00]">Duration</th>
                  <th className="px-4 py-3 border-b border-white/10 font-semibold text-[#C8FF00]">Type</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 border-b border-white/10 font-mono text-sm">cookie_consent</td>
                  <td className="px-4 py-3 border-b border-white/10">Stores the user&apos;s cookie consent preference.</td>
                  <td className="px-4 py-3 border-b border-white/10">1 year</td>
                  <td className="px-4 py-3 border-b border-white/10">Essential</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 border-b border-white/10 font-mono text-sm">finrush_lang</td>
                  <td className="px-4 py-3 border-b border-white/10">Stores the user&apos;s preferred language for the interface.</td>
                  <td className="px-4 py-3 border-b border-white/10">Session / Persistent</td>
                  <td className="px-4 py-3 border-b border-white/10">Essential</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 border-b border-white/10 font-mono text-sm">finrush_currency</td>
                  <td className="px-4 py-3 border-b border-white/10">Stores the user&apos;s preferred currency for the dashboard.</td>
                  <td className="px-4 py-3 border-b border-white/10">Session / Persistent</td>
                  <td className="px-4 py-3 border-b border-white/10">Essential</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 border-b border-white/10 font-mono text-sm">sb-[id]-auth-token</td>
                  <td className="px-4 py-3 border-b border-white/10">Supabase authentication token to securely identify the user session.</td>
                  <td className="px-4 py-3 border-b border-white/10">Session</td>
                  <td className="px-4 py-3 border-b border-white/10">Security / Essential</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Third Party Cookies</h2>
          <p>In some special cases we also use cookies provided by trusted third parties. This site may use analytics solutions which are widespread and trusted analytics solutions on the web for helping us to understand how you use the site and ways that we can improve your experience.</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">5. Disabling Cookies</h2>
          <p>You can prevent the setting of cookies by adjusting the settings on your browser (see your browser Help for how to do this). Be aware that disabling cookies will affect the functionality of this and many other websites that you visit. Disabling cookies will usually result in also disabling certain functionality and features of this site.</p>
        </div>
      </div>
    </LandingLayout>
  );
}
