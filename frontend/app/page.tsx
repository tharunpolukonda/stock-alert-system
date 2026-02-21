'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowRight, TrendingUp, Bell, ShieldCheck } from 'lucide-react'
import AuthModal from '@/components/AuthModal'

/* ─── Animated SVG stock chart background ─── */
function StockChartBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-20"
      viewBox="0 0 1440 600"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Green rising chart */}
      <polyline
        points="0,480 120,420 200,390 320,310 420,280 520,240 620,210 720,170 820,140 920,110 1040,80 1200,50 1440,20"
        fill="none"
        stroke="#22c55e"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points="0,480 120,420 200,390 320,310 420,280 520,240 620,210 720,170 820,140 920,110 1040,80 1200,50 1440,20 1440,600 0,600"
        fill="url(#greenGrad)"
      />

      {/* Red falling chart (secondary) */}
      <polyline
        points="0,120 100,160 220,200 360,260 460,300 580,350 680,380 800,420 940,460 1100,500 1260,530 1440,570"
        fill="none"
        stroke="#ef4444"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="6 4"
      />

      {/* Horizontal grid lines */}
      {[150, 300, 450].map((y) => (
        <line
          key={y}
          x1="0"
          y1={y}
          x2="1440"
          y2={y}
          stroke="white"
          strokeOpacity="0.05"
          strokeWidth="1"
        />
      ))}

      {/* Candlestick-like bars */}
      {[60, 180, 300, 420, 540, 660, 780, 900, 1020, 1140, 1260, 1380].map((x, i) => {
        const isGreen = i % 2 === 0
        const top = 200 + (i % 5) * 40
        const height = 60 + (i % 3) * 30
        return (
          <g key={x}>
            <rect
              x={x - 8}
              y={top}
              width={16}
              height={height}
              rx={2}
              fill={isGreen ? '#22c55e' : '#ef4444'}
              fillOpacity="0.3"
            />
            <line
              x1={x}
              y1={top - 15}
              x2={x}
              y2={top + height + 15}
              stroke={isGreen ? '#22c55e' : '#ef4444'}
              strokeOpacity="0.4"
              strokeWidth="1.5"
            />
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
      {/* Main central tower */}
      <rect x="650" y="20" width="140" height="200" fill="#3b82f6" />
      <rect x="670" y="0" width="100" height="30" fill="#60a5fa" />
      <rect x="700" y="-10" width="40" height="20" fill="#93c5fd" />
      {/* Windows central */}
      {[40, 70, 100, 130, 160].map(y =>
        [670, 700, 730, 750].map(x => (
          <rect key={`${x}-${y}`} x={x} y={y} width={10} height={14} fill="#1e40af" rx={1} />
        ))
      )}
      {/* Left wing */}
      <rect x="500" y="80" width="150" height="140" fill="#2563eb" />
      <rect x="510" y="70" width="130" height="20" fill="#3b82f6" />
      {[95, 120, 145, 170].map(y =>
        [515, 540, 565, 590, 615].map(x => (
          <rect key={`${x}-${y}`} x={x} y={y} width={9} height={12} fill="#1e3a8a" rx={1} />
        ))
      )}
      {/* Right wing */}
      <rect x="790" y="80" width="150" height="140" fill="#2563eb" />
      <rect x="800" y="70" width="130" height="20" fill="#3b82f6" />
      {[95, 120, 145, 170].map(y =>
        [805, 830, 855, 880, 905].map(x => (
          <rect key={`${x}-${y}`} x={x} y={y} width={9} height={12} fill="#1e3a8a" rx={1} />
        ))
      )}
      {/* Shorter left buildings */}
      <rect x="350" y="120" width="100" height="100" fill="#1d4ed8" />
      <rect x="200" y="140" width="120" height="80" fill="#1e40af" />
      <rect x="100" y="160" width="80" height="60" fill="#1d4ed8" />
      <rect x="0" y="170" width="80" height="50" fill="#1e3a8a" />
      {/* Shorter right buildings */}
      <rect x="990" y="120" width="100" height="100" fill="#1d4ed8" />
      <rect x="1120" y="140" width="120" height="80" fill="#1e40af" />
      <rect x="1260" y="160" width="80" height="60" fill="#1d4ed8" />
      <rect x="1360" y="170" width="80" height="50" fill="#1e3a8a" />
      {/* Ground */}
      <rect x="0" y="218" width="1440" height="4" fill="#1e40af" />
    </svg>
  )
}

/* ─── Bull SVG ─── */
function BullIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="38" rx="14" ry="10" fill="#22c55e" fillOpacity="0.9" />
      <ellipse cx="32" cy="28" rx="10" ry="9" fill="#22c55e" />
      {/* Horns */}
      <path d="M23 22 Q16 12 14 8" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" />
      <path d="M41 22 Q48 12 50 8" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" />
      {/* Face */}
      <ellipse cx="28" cy="26" rx="2.5" ry="2.5" fill="white" />
      <ellipse cx="36" cy="26" rx="2.5" ry="2.5" fill="white" />
      <ellipse cx="28.5" cy="26.5" rx="1.2" ry="1.2" fill="#14532d" />
      <ellipse cx="36.5" cy="26.5" rx="1.2" ry="1.2" fill="#14532d" />
      <ellipse cx="32" cy="32" rx="4" ry="2.5" fill="#16a34a" />
      <circle cx="30" cy="32" r="1" fill="#86efac" />
      <circle cx="34" cy="32" r="1" fill="#86efac" />
      {/* Legs */}
      <rect x="21" y="46" width="5" height="12" rx="2" fill="#22c55e" />
      <rect x="29" y="46" width="5" height="12" rx="2" fill="#22c55e" />
      <rect x="37" y="46" width="5" height="12" rx="2" fill="#22c55e" />
      {/* Tail */}
      <path d="M46 38 Q54 34 52 28" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* ─── Bear SVG ─── */
function BearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="40" rx="14" ry="10" fill="#ef4444" fillOpacity="0.9" />
      <ellipse cx="32" cy="28" rx="11" ry="10" fill="#ef4444" />
      {/* Ears */}
      <circle cx="22" cy="19" r="5" fill="#ef4444" />
      <circle cx="42" cy="19" r="5" fill="#ef4444" />
      <circle cx="22" cy="19" r="3" fill="#fca5a5" />
      <circle cx="42" cy="19" r="3" fill="#fca5a5" />
      {/* Face */}
      <ellipse cx="27" cy="27" rx="2.5" ry="2.5" fill="white" />
      <ellipse cx="37" cy="27" rx="2.5" ry="2.5" fill="white" />
      <ellipse cx="27.5" cy="27.5" rx="1.2" ry="1.2" fill="#7f1d1d" />
      <ellipse cx="37.5" cy="27.5" rx="1.2" ry="1.2" fill="#7f1d1d" />
      <ellipse cx="32" cy="33" rx="4.5" ry="2.5" fill="#dc2626" />
      <circle cx="30" cy="33" r="1" fill="#fca5a5" />
      <circle cx="34" cy="33" r="1" fill="#fca5a5" />
      {/* Legs */}
      <rect x="21" y="47" width="5" height="11" rx="2" fill="#ef4444" />
      <rect x="29" y="47" width="5" height="11" rx="2" fill="#ef4444" />
      <rect x="37" y="47" width="5" height="11" rx="2" fill="#ef4444" />
      {/* Tail */}
      <path d="M46 40 Q52 38 50 32" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
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

      {/* ── Animated stock chart background ── */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <StockChartBg />
      </div>

      {/* ── BSE building skyline ── */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-0">
        <BuildingSilhouette />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-1 flex-col">

        {/* ── Header / Navbar ── */}
        <header className="flex items-center justify-between px-6 py-5 md:px-12">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/30">
              <TrendingUp className="h-5 w-5 text-white" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
            </div>
            <span className="text-2xl font-black tracking-tight text-white">Hoox</span>
          </div>

          {/* Sign In */}
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-600/15 px-5 py-2 text-sm font-semibold text-blue-300 backdrop-blur-sm transition-all hover:bg-blue-600/30 hover:text-white hover:border-blue-400"
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

          {/* Bull & Bear flanking title */}
          <div className="flex items-center justify-center gap-4 md:gap-8 mb-2">
            <BullIcon className="h-20 w-20 md:h-28 md:w-28 drop-shadow-lg" />

            <div>
              <h1 className="text-6xl font-black tracking-tight md:text-8xl">
                <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-indigo-400 bg-clip-text text-transparent">
                  Hoox
                </span>
              </h1>
            </div>

            <BearIcon className="h-20 w-20 md:h-28 md:w-28 drop-shadow-lg" />
          </div>

          {/* Tagline — exactly 10 words */}
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
              className="group flex items-center justify-center gap-2 rounded-full bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-500 hover:shadow-blue-400/40"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
            >
              Sign In
            </button>
          </div>

          {/* ── Feature pills ── */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
            {[
              { icon: <Bell className="h-3.5 w-3.5" />, label: 'Smart Alerts', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
              { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Live Prices', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
              { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: 'Secure & Private', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
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
