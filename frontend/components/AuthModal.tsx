'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { X, Mail, Lock, User, Loader2 } from 'lucide-react'

interface AuthModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [isLogin, setIsLogin] = useState(true)
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const router = useRouter()
    const supabase = createClient()

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (isLogin) {
                // 1. Lookup email from username
                const { data: profile, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('email')
                    .eq('username', username)
                    .single()

                if (profileError || !profile) {
                    console.error('Profile lookup error:', profileError)
                    throw new Error('Username not found. Please checks your username or sign up.')
                }

                // 2. Sign in with retrieved email
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: profile.email,
                    password,
                })

                if (signInError) {
                    if (signInError.message.includes('Email not confirmed')) {
                        throw new Error('Please confirm your email address or disable "Confirm Email" in Supabase Auth settings.')
                    }
                    throw signInError
                }

                router.push('/dashboard')
                router.refresh()
                onClose()
            } else {
                // Signup: Use provided email
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username,
                        },
                    },
                })
                if (error) throw error
                onClose()
                router.push('/dashboard')
                router.refresh()
            }
        } catch (err: any) {
            console.error(err)
            setError(err.message || 'Authentication failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-8 shadow-2xl animate-in zoom-in-95 duration-200 relative">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-gray-400 hover:text-white"
                >
                    <X className="h-5 w-5" />
                </button>

                <h2 className="mb-2 text-2xl font-bold text-white">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="mb-6 text-sm text-gray-400">
                    {isLogin ? 'Enter your credentials to access your dashboard' : 'Sign up to start tracking stocks'}
                </p>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500 border border-red-500/20">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400 uppercase">Username</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-black/50 py-2.5 pl-10 pr-4 text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="johndoe"
                            />
                        </div>
                    </div>

                    {!isLogin && (
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-400 uppercase">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-black/50 py-2.5 pl-10 pr-4 text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="name@example.com"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400 uppercase">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-black/50 py-2.5 pl-10 pr-4 text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isLogin ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-400">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="font-medium text-blue-400 hover:text-blue-300"
                    >
                        {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                </div>
            </div>
        </div>
    )
}
