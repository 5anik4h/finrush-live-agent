"use client";

import Link from "next/link";
import { ChevronDown, ArrowRight, Mic, Camera, BrainCircuit, PieChart, Briefcase, Wallet, Target, TrendingUp, Zap, LayoutDashboard, Globe, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import LandingLayout from "@/components/landing/LandingLayout";

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { session } = useAuth();
  const ctaHref = session ? "/dashboard" : "/login";

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const processSteps = [
    {
      icon: <Mic className="w-8 h-8 text-[#C8FF00]" />,
      title: "Talk or Type",
      description: "Simply tell Finrush about your transactions, income, or expenses using your voice or plain text.",
    },
    {
      icon: <Camera className="w-8 h-8 text-[#C8FF00]" />,
      title: "Snap a Photo",
      description: "Categorize receipts and invoices instantly by just taking a photo of them.",
    },
    {
      icon: <BrainCircuit className="w-8 h-8 text-[#C8FF00]" />,
      title: "AI Categorization",
      description: "Our advanced AI automatically processes, categorizes, and organizes every detail.",
    },
    {
      icon: <PieChart className="w-8 h-8 text-[#C8FF00]" />,
      title: "Visualize Charts",
      description: "Understand your spending patterns through interactive charts without touching a spreadsheet.",
    },
    {
      icon: <Briefcase className="w-8 h-8 text-[#C8FF00]" />,
      title: "Advanced Portfolio",
      description: "Manage your investments and track your complete net worth in one unified platform.",
    },
  ];

  const features = [
    {
      icon: <Wallet className="w-6 h-6 text-[#C8FF00]" />,
      title: "Wealth Tracking",
      description: "Watch your net worth grow in real-time across all your accounts."
    },
    {
      icon: <Target className="w-6 h-6 text-[#C8FF00]" />,
      title: "Budgeting",
      description: "Set monthly limits and create savings pots for your future goals."
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-[#C8FF00]" />,
      title: "Investments",
      description: "Track stocks, crypto, and real estate with live market prices."
    },
    {
      icon: <Mic className="w-6 h-6 text-[#C8FF00]" />,
      title: "Voice-First Experience",
      description: "Record transactions hands-free with an interactive voice assistant."
    },
    {
      icon: <Zap className="w-6 h-6 text-[#C8FF00]" />,
      title: "Intelligent Processing",
      description: "Instant semantic extraction of merchants, amounts, and dates."
    },
    {
      icon: <LayoutDashboard className="w-6 h-6 text-[#C8FF00]" />,
      title: "Comprehensive Dashboard",
      description: "View all your financial data in beautiful, actionable widgets."
    },
    {
      icon: <Globe className="w-6 h-6 text-[#C8FF00]" />,
      title: "Multi-Currency Support",
      description: "Seamlessly handle transactions in USD, EUR, GBP, and more."
    },
    {
      icon: <MessageCircle className="w-6 h-6 text-[#C8FF00]" />,
      title: "Bilingual Context",
      description: "Speak or type in English or Spanish, the AI understands perfectly."
    }
  ];

  const faqs = [
    {
      question: "How does Finrush replace my spreadsheets?",
      answer: "Finrush acts as a natural language financial assistant. Instead of manually entering numbers into columns, you simply tell Finrush what you spent or earned. It automatically structures the data into beautiful, actionable dashboards.",
    },
    {
      question: "Is my financial data secure?",
      answer: "Absolutely. We employ bank-level encryption (AES-256) and strict privacy policies. Your data is never sold to third parties and is solely used to provide your personal insights.",
    },
    {
      question: "Can I use voice commands on mobile?",
      answer: "Yes! Our seamless mobile experience features a floating voice agent that lets you record transactions hands-free, perfect for when you're on the go.",
    },
    {
      question: "Do I need technical skills to use Finrush?",
      answer: "Not at all. If you know how to send a voice message, you know how to use Finrush. The AI handles all the complex tagging and categorization for you.",
    },
  ];

  return (
    <LandingLayout>
      {/* Hero Section */}
      <section className="relative z-10 py-24 md:py-32 px-6">
        <div className="container mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-[#C8FF00] animate-pulse"></span>
            <span className="text-sm font-medium text-[#C8FF00]">The future of personal finance is here</span>
          </div>

          <h1 className="text-4xl md:text-7xl font-bold tracking-tight mb-6 md:mb-8 leading-tight">
            Financial Autopilot for the <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8FF00] to-[#7BC67E]">
              Modern Life.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Ditch the endless spreadsheets and manual entry. Finrush uses conversational AI to instantly catalog, track, and visualize your finances. Just speak, and we do the rest.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={ctaHref}
              className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-bold text-[#050E08] bg-[#C8FF00] rounded-full overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(200,255,0,0.4)] w-full sm:w-auto"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#8BC34A] to-[#C8FF00] opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative flex items-center gap-2">
                Sign In for Free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            
            <Link
              href="/demo"
              className="group inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-transparent border-2 border-white/20 rounded-full hover:bg-white/5 hover:border-white/40 transition-all w-full sm:w-auto"
            >
              Try Live Demo
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 py-24 bg-[#050E08] border-y border-white/10 backdrop-blur-xl">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">How It Works</h2>
            <p className="text-gray-400 text-lg">Managing finances shouldn&apos;t feel like a second job. Simply feed data to the AI and watch your portfolio organize itself.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 max-w-6xl mx-auto">
            {processSteps.map((step, idx) => (
              <div key={idx} className="relative p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-colors group flex-1 min-w-[300px] max-w-[380px]">
                <div className="absolute top-0 right-0 p-8 text-8xl font-black text-white/[0.03] pointer-events-none select-none group-hover:text-white/[0.05] transition-colors">
                  {idx + 1}
                </div>
                <div className="w-16 h-16 rounded-2xl bg-[#C8FF00]/10 flex items-center justify-center mb-6 border border-[#C8FF00]/20 shadow-[0_0_20px_rgba(200,255,0,0.10)]">
                  {step.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed relative z-10">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 py-24 px-6 bg-transparent">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Everything you need</h2>
            <p className="text-gray-400 text-lg">Powerful features designed to give you absolute clarity and control over your wealth.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <div className="mb-4 inline-flex p-3 rounded-lg bg-[#0A1A0F] border border-white/5 shadow-inner">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-2 text-white">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="relative z-10 py-24 bg-[#050E08] border-y border-white/10">
        <div className="container mx-auto max-w-5xl text-center px-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
            <span className="text-sm font-medium text-emerald-400">Bank-Level Security</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Privacy First. Always.</h2>
          <p className="text-gray-400 text-lg mb-16 max-w-2xl mx-auto">Your financial data is yours alone. We employ industry-leading encryption so you can track your wealth with peace of mind.</p>
          
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full filter blur-xl"></div>
              <h3 className="text-xl font-bold mb-3 text-white">AES-256 Encryption</h3>
              <p className="text-gray-400">Your data is encrypted at rest and in transit ensuring top-tier compliance and safety against breaches.</p>
            </div>
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full filter blur-xl"></div>
              <h3 className="text-xl font-bold mb-3 text-white">No Data Selling</h3>
              <p className="text-gray-400">We do not sell your personal or financial data to third parties. Your information is never used for targeted ads.</p>
            </div>
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full filter blur-xl"></div>
              <h3 className="text-xl font-bold mb-3 text-white">Private AI</h3>
              <p className="text-gray-400">Voice inputs and text interactions are securely processed and are not retained to train public AI models.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions Section */}
      <section className="relative z-10 py-24 md:py-32 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Frequently Asked Questions</h2>
            <p className="text-gray-400 text-lg">Everything you need to know about the product and billing.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden transition-colors hover:bg-white/[0.07]"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="text-lg font-medium pr-8">{faq.question}</span>
                  <ChevronDown
                    className={`w-6 h-6 text-[#C8FF00] transition-transform duration-300 flex-shrink-0 ${openFaq === idx ? 'rotate-180' : ''}`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === idx ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="p-6 pt-0 text-gray-400 leading-relaxed border-t border-white/5 mt-2">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
