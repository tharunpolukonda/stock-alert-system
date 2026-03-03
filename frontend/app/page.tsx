'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowRight, TrendingUp, Bell, ShieldCheck } from 'lucide-react'
import AuthModal from '@/components/AuthModal'
import Image from 'next/image'

/* ─── Animated SVG stock chart background ─── */
function StockChartBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-15"
      viewBox="0 0 1440 600"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="darkBlueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Rising chart */}
      <polyline
        points="0,480 120,420 200,390 320,310 420,280 520,240 620,210 720,170 820,140 920,110 1040,80 1200,50 1440,20"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points="0,480 120,420 200,390 320,310 420,280 520,240 620,210 720,170 820,140 920,110 1040,80 1200,50 1440,20 1440,600 0,600"
        fill="url(#blueGrad)"
      />

      {/* Secondary chart */}
      <polyline
        points="0,120 100,160 220,200 360,260 460,300 580,350 680,380 800,420 940,460 1100,500 1260,530 1440,570"
        fill="none"
        stroke="#60a5fa"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="6 4"
      />

      {/* Grid */}
      {[150, 300, 450].map((y) => (
        <line key={y} x1="0" y1={y} x2="1440" y2={y} stroke="#3b82f6" strokeOpacity="0.08" strokeWidth="1" />
      ))}

      {/* Candlesticks */}
      {[60, 180, 300, 420, 540, 660, 780, 900, 1020, 1140, 1260, 1380].map((x, i) => {
        const top = 200 + (i % 5) * 40
        const height = 60 + (i % 3) * 30
        return (
          <g key={x}>
            <rect x={x - 8} y={top} width={16} height={height} rx={2} fill="#3b82f6" fillOpacity="0.25" />
            <line x1={x} y1={top - 15} x2={x} y2={top + height + 15} stroke="#3b82f6" strokeOpacity="0.3" strokeWidth="1.5" />
          </g>
        )
      })}
    </svg>
  )
}

/* ─── BSE-inspired building silhouette ─── */
function BuildingSilhouette() {
  return (
    <svg
      className="absolute bottom-0 left-0 right-0 w-full opacity-10"
      viewBox="0 0 1440 220"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMax slice"
    >
      <rect x="650" y="20" width="140" height="200" fill="#3b82f6" />
      <rect x="670" y="0" width="100" height="30" fill="#60a5fa" />
      <rect x="700" y="-10" width="40" height="20" fill="#93c5fd" />
      {[40, 70, 100, 130, 160].map(y =>
        [670, 700, 730, 750].map(x => (
          <rect key={`${x}-${y}`} x={x} y={y} width={10} height={14} fill="#1e40af" rx={1} />
        ))
      )}
      <rect x="500" y="80" width="150" height="140" fill="#2563eb" />
      <rect x="510" y="70" width="130" height="20" fill="#3b82f6" />
      {[95, 120, 145, 170].map(y =>
        [515, 540, 565, 590, 615].map(x => (
          <rect key={`${x}-${y}`} x={x} y={y} width={9} height={12} fill="#1e3a8a" rx={1} />
        ))
      )}
      <rect x="790" y="80" width="150" height="140" fill="#2563eb" />
      <rect x="800" y="70" width="130" height="20" fill="#3b82f6" />
      {[95, 120, 145, 170].map(y =>
        [805, 830, 855, 880, 905].map(x => (
          <rect key={`${x}-${y}`} x={x} y={y} width={9} height={12} fill="#1e3a8a" rx={1} />
        ))
      )}
      <rect x="350" y="120" width="100" height="100" fill="#1d4ed8" />
      <rect x="200" y="140" width="120" height="80" fill="#1e40af" />
      <rect x="100" y="160" width="80" height="60" fill="#1d4ed8" />
      <rect x="0" y="170" width="80" height="50" fill="#1e3a8a" />
      <rect x="990" y="120" width="100" height="100" fill="#1d4ed8" />
      <rect x="1120" y="140" width="120" height="80" fill="#1e40af" />
      <rect x="1260" y="160" width="80" height="60" fill="#1d4ed8" />
      <rect x="1360" y="170" width="80" height="50" fill="#1e3a8a" />
      <rect x="0" y="218" width="1440" height="4" fill="#1e40af" />
    </svg>
  )
}

export default function Home() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.push('/dashboard')
    }
    checkUser()
  }, [supabase, router])

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[#020817] text-white">

      {/* ── Radial glow blobs ── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-5%] h-[500px] w-[500px] rounded-full bg-blue-700/20 blur-[120px]" />
        <div className="absolute top-[20%] right-[-8%] h-[400px] w-[400px] rounded-full bg-blue-500/15 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[30%] h-[300px] w-[300px] rounded-full bg-indigo-700/20 blur-[90px]" />
      </div>

      {/* ── Chart background ── */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <StockChartBg />
      </div>

      {/* ── Building skyline ── */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-0">
        <BuildingSilhouette />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-1 flex-col">

        {/* ── Header / Navbar ── */}
        <header className="flex items-center justify-between px-6 py-4 md:px-12">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="/assets/HooxMainLogo-removebg-preview.png"
              alt="Hoox Logo"
              width={120}
              height={40}
              className="h-10 w-auto drop-shadow-lg"
              priority
            />
          </div>

          {/* Sign In */}
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-600/15 px-5 py-2 text-sm font-semibold text-blue-300 backdrop-blur-sm transition-all hover:bg-blue-600/30 hover:text-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/20"
          >
            Sign In
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </header>

        {/* ── Hero ── */}
        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-32 pt-12 text-center">

          {/* Live badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-600/10 px-4 py-1.5 text-xs font-semibold text-blue-300 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            NSE · BSE · Real-time Alerts
          </div>

          {/* Bull & Bear flanking Hoox logo */}
          <div className="flex items-center justify-center gap-4 md:gap-8 mb-2">
            {/* Bull on LEFT */}
            <div className="relative animate-float">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl" />
              <Image
                src="/assets/bull_premium_1771778168693.png"
                alt="Bull"
                width={160}
                height={160}
                className="relative h-24 w-24 md:h-36 md:w-36 drop-shadow-2xl object-contain hover:scale-110 transition-transform duration-500"
              />
            </div>

            {/* Hoox Logo in center */}
            <div>
              <Image
                src="/assets/HooxMainLogo-removebg-preview.png"
                alt="Hoox"
                width={320}
                height={100}
                className="h-16 w-auto md:h-24 drop-shadow-2xl"
                priority
              />
            </div>

            {/* Bear on RIGHT */}
            <div className="relative animate-float-slow">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl" />
              <Image
                src="/assets/bear_blue_premium_1771777968054.png"
                alt="Bear"
                width={160}
                height={160}
                className="relative h-24 w-24 md:h-36 md:w-36 drop-shadow-2xl object-contain hover:scale-110 transition-transform duration-500"
              />
            </div>
          </div>

          {/* Tagline */}
          <p className="mb-3 text-lg font-semibold text-gray-200 md:text-xl tracking-wide">
            Smart stock alerts for every Indian market move.
          </p>

          {/* Sub-description */}
          <p className="mb-10 max-w-md text-sm text-gray-400 leading-relaxed">
            Track NSE &amp; BSE stocks, get instant Discord notifications, and monitor your portfolio — all in one place.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <button
              onClick={() => setShowAuthModal(true)}
              className="group flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-400/40 hover:scale-105"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:scale-105"
            >
              Sign In
            </button>
          </div>

          {/* ── Feature pills ── */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
            {[
              { icon: <Bell className="h-3.5 w-3.5" />, label: 'Smart Alerts', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
              { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Live Prices', color: 'text-blue-300 border-blue-400/30 bg-blue-400/10' },
              { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: 'Secure & Private', color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' },
            ].map((f) => (
              <span
                key={f.label}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${f.color}`}
              >
                {f.icon}
                {f.label}
              </span>
            ))}
          </div>
        </main>
      </div>

      {/* ── Auth Modal ── */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  )
}
