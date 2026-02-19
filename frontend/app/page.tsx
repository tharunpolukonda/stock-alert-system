'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, BarChart3, Bell, Shield, Wallet } from 'lucide-react'
import AuthButton from '@/components/AuthButton'
import AuthModal from '@/components/AuthModal'

export default function Home() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/dashboard')
      }
    }
    checkUser()
  }, [supabase, router])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container mx-auto flex items-center justify-between p-6">
        {/* ... logo ... */}
        <div className="flex items-center gap-2 text-xl font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <BarChart3 className="h-5 w-5" />
          </div>
          StockAlert
        </div>
        <nav className="hidden gap-6 text-sm text-gray-400 md:flex">
          <Link href="#features" className="hover:text-white">Features</Link>
          <Link href="#pricing" className="hover:text-white">Pricing</Link>
          <Link href="#about" className="hover:text-white">About</Link>
        </nav>
        <AuthButton onClick={() => setShowAuthModal(true)} />
      </header>

      <main className="flex-1">
        <section className="container mx-auto flex flex-col items-center justify-center px-6 py-20 text-center md:py-32">
          {/* ... hero text ... */}
          <div className="mb-6 inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm text-blue-400">
            <span className="mr-2 flex h-2 w-2">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            Real-time Indian Stock Market Alerts
          </div>

          <h1 className="mb-6 max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl md:text-7xl">
            Never miss a <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">market move</span> again.
          </h1>

          <p className="mb-10 max-w-2xl text-lg text-gray-400">
            Automated tracking for NSE/BSE stocks. Get instant Discord notifications when your target prices are hit or when significant volatility is detected.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <button
              onClick={() => setShowAuthModal(true)}
              className="group flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3 font-medium text-black transition-all hover:bg-gray-200"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <Link
              href="#demo"
              className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-3 font-medium text-white backdrop-blur-sm transition-all hover:bg-white/10"
            >
              View Demo
            </Link>
          </div>
        </section>

        <section id="features" className="border-t border-white/5 bg-white/5 px-6 py-20 backdrop-blur-sm">
          <div className="container mx-auto">
            <h2 className="mb-12 text-center text-3xl font-bold">Why choose StockAlert?</h2>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  icon: <Bell className="h-6 w-6 text-blue-400" />,
                  title: "Smart Alerts",
                  desc: "Set custom price targets or percentage change thresholds (10% gain, 5% loss)."
                },
                {
                  icon: <Wallet className="h-6 w-6 text-purple-400" />,
                  title: "Real-time Tracking",
                  desc: "Continuous monitoring during market hours (9:30 AM - 3:30 PM IST)."
                },
                {
                  icon: <Shield className="h-6 w-6 text-green-400" />,
                  title: "Secure & Private",
                  desc: "Enterprise-grade security with Supabase. Your data is encrypted and safe."
                }
              ].map((feature, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-black/40 p-8 transition-colors hover:border-white/20">
                  <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-white/5 p-3">
                    {feature.icon}
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-gray-400">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black py-8 text-center text-sm text-gray-500">
        <div className="container mx-auto">
          © {new Date().getFullYear()} StockAlert System. built by Antigravity.
        </div>
      </footer>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  )
}
