import LandingLayout from "@/components/landing/LandingLayout";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <LandingLayout>
      <div className="container mx-auto max-w-4xl pt-12 p-6">
        <Link href="/" className="inline-flex items-center gap-2 text-[#C8FF00] mb-8 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert max-w-none text-gray-300 space-y-6">
          <p><strong>Last Updated:</strong> [Date]</p>
          
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Introduction</h2>
          <p>Welcome to Finrush. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website (regardless of where you visit it from) and tell you about your privacy rights and how the law protects you.</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. The Data We Collect About You</h2>
          <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together follows:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
            <li><strong>Contact Data</strong> includes email address.</li>
            <li><strong>Financial Data</strong> includes bank account and payment card details, income, expenses, and investment information provided directly by you to the assistant.</li>
            <li><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version.</li>
            <li><strong>Audio Data</strong> includes voice recordings processed in real-time to provide the transcription and assistant functionalities. Recordings may be processed dynamically using third-party AI APIs (such as Google Gemini Live).</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. How We Use Your Personal Data</h2>
          <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
            <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
            <li>Where we need to comply with a legal or regulatory obligation.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Data Security</h2>
          <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed. Your data is encrypted at rest and in transit.</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">5. Your Legal Rights</h2>
          <p>Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, restriction, transfer, to object to processing, to portability of data, and (where the lawful ground of processing is consent) to withdraw consent.</p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">6. Contact Details</h2>
          <p>If you have any questions about this privacy policy or our privacy practices, please contact us at:</p>
          <p>Email address: [Email Address]</p>
          <p>Postal address: [Company Address]</p>
        </div>
      </div>
    </LandingLayout>
  );
}
