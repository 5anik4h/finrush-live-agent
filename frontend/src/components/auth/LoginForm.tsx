"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { ArrowRight, Mail, Loader2 } from 'lucide-react'

// SVG for Google Icon
const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
)

export function LoginForm() {
    const [email, setEmail] = useState('')
    const [isSubmittingGoogle, setIsSubmittingGoogle] = useState(false)
    const [isSubmittingEmail, setIsSubmittingEmail] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleGoogleLogin = async () => {
        setIsSubmittingGoogle(true)
        setError(null)

        const supabase = createClient()
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/dashboard`
            }
        })

        if (error) {
            setError(error.message)
            setIsSubmittingGoogle(false)
        }
    }

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmittingEmail(true)
        setError(null)

        const supabase = createClient()

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                // Redirection to dashboard when confirming mail
                emailRedirectTo: `${window.location.origin}/dashboard`
            }
        })

        if (error) {
            setError(error.message)
        } else {
            setSuccess(true)
        }

        setIsSubmittingEmail(false)
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 p-8 bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="h-12 w-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <Mail className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-medium text-white">Check your email</h3>
                <p className="text-center text-sm text-zinc-400">
                    We sent a magic link to <span className="text-zinc-200 font-medium">{email}</span>. Click it to sign in.
                </p>
            </div>
        )
    }

    return (
        <div className="w-full max-w-sm">
            <div className="flex flex-col bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />

                <div className="space-y-2 text-center mb-6">
                    <h2 className="text-2xl font-semibold text-white tracking-tight">Welcome back</h2>
                    <p className="text-sm text-zinc-400">Sign in to your agent dashboard</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 text-center mb-6">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleGoogleLogin}
                    disabled={isSubmittingGoogle || isSubmittingEmail}
                    className="w-full flex items-center justify-center py-3 px-4 bg-white text-black hover:bg-zinc-200 font-medium rounded-xl transition-all group disabled:opacity-50"
                >
                    {isSubmittingGoogle ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <>
                            <GoogleIcon />
                            Continue with Google
                        </>
                    )}
                </button>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-zinc-900/80 px-4 text-zinc-500 rounded-full">Or continue with</span>
                    </div>
                </div>

                <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 pointer-events-none" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-sans"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmittingEmail || isSubmittingGoogle || !email}
                        className="w-full flex items-center justify-center py-3 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-50 font-medium rounded-xl transition-all group"
                    >
                        {isSubmittingEmail ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                Continue with Email
                                <ArrowRight className="ml-2 h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
