import LandingLayout from "@/components/landing/LandingLayout";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <LandingLayout>
      <div className="container mx-auto max-w-4xl pt-12 p-6">
        <Link href="/" className="inline-flex items-center gap-2 text-[#C8FF00] mb-8 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>

        <div className="prose prose-invert max-w-none text-gray-300 space-y-6">
          <p><strong>Last Updated:</strong> 03-16-2026</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Agreement to Terms</h2>
          <p>By accessing or using Finrush, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, then you may not access the service.</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. Description of Service</h2>
          <p>Finrush is an AI-powered personal financial assistant. The Service allows users to input financial data via text or voice, track income, expenses, budgets, savings, and investments.</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. Disclaimers and Limitations</h2>
          <p><strong>No Financial Advice:</strong> Finrush provides information and tools for organizing your personal finances. The Service does not provide financial, investment, legal, or tax advice. You should consult a qualified professional before making any financial decisions.</p>
          <p><strong>Accuracy of AI:</strong> While we strive for accuracy, the Service uses artificial intelligence which may occasionally make errors in transcription, categorization, or calculation. You are responsible for verifying the accuracy of the data and outputs produced by the Service.</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. User Accounts</h2>
          <p>When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">5. Intellectual Property</h2>
          <p>The Service and its original content, features, and functionality are and will remain the exclusive property of Finrush and its licensors. The Service is protected by copyright, trademark, and other laws.</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">6. Termination</h2>
          <p>We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
        </div>
      </div>
    </LandingLayout>
  );
}
