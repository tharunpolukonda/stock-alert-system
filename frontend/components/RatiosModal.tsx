'use client'

import { useEffect, useState } from 'react'
import {
    X,
    TrendingDown,
    TrendingUp,
    BarChart3,
    Loader2,
    AlertCircle,
    Building2,
    Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RatiosModalProps {
    companyName: string
    cmp: number
    onClose: () => void
}

interface StockDetails {
    company_name: string
    price: number | null
    high: number | null
    low: number | null
    market_cap: string | null
    roe: string | null
    roce: string | null
    description: string | null
    success: boolean
    error: string | null
}

export function RatiosModal({ companyName, cmp, onClose }: RatiosModalProps) {
    const [details, setDetails] = useState<StockDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const apiBase = (
                    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
                ).replace(/\/$/, '')

                const res = await fetch(`${apiBase}/api/stock-details`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    cache: 'no-store',
                    body: JSON.stringify({ company_name: companyName }),
                })

                if (!res.ok) throw new Error(`Server error: ${res.status}`)
                const data: StockDetails = await res.json()

                if (!data.success && !data.high && !data.low) {
                    setError(data.error || 'Failed to fetch stock details')
                } else {
                    setDetails(data)
                }
            } catch (err: any) {
                setError(err.message || 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        fetchDetails()
    }, [companyName])

    // Use CMP from live price if screener also returned one; otherwise use prop
    const currentPrice = details?.price ?? cmp

    const pctFallenFromHigh =
        details?.high && details.high > 0
            ? ((details.high - currentPrice) * 100) / details.high
            : null

    const pctGainedFromLow =
        details?.low && details.low > 0
            ? ((currentPrice - details.low) * 100) / details.low
            : null

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            {/* Modal box */}
            <div
                className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0d0d0d] px-5 py-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-purple-400" />
                        <div>
                            <h2 className="text-base font-bold text-white leading-tight">Other Ratios</h2>
                            <p className="text-xs text-gray-400">{companyName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full bg-white/10 p-1.5 text-gray-400 hover:bg-white/20 hover:text-white"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-5">

                    {/* Loading */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                            <p className="text-sm">Fetching ratios from screener.in…</p>
                        </div>
                    )}

                    {/* Error */}
                    {!loading && error && (
                        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-red-400">Could not load details</p>
                                <p className="text-xs text-red-300/80 mt-0.5">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Data */}
                    {!loading && details && (
                        <>
                            {/* Current Price pill */}
                            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                <span className="text-xs text-gray-400">Current Market Price</span>
                                <span className="text-lg font-bold text-white">₹{currentPrice.toLocaleString('en-IN')}</span>
                            </div>

                            {/* 52-Week High / Low + computed percentages */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* High card */}
                                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <TrendingDown className="h-4 w-4 text-red-400" />
                                        <span className="text-xs text-gray-400">52-Week High</span>
                                    </div>
                                    <p className="text-xl font-bold text-white">
                                        {details.high != null ? `₹${details.high.toLocaleString('en-IN')}` : '—'}
                                    </p>
                                    {pctFallenFromHigh != null && (
                                        <div className="mt-2">
                                            <span className={cn(
                                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                                                pctFallenFromHigh > 0
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : 'bg-green-500/20 text-green-400'
                                            )}>
                                                <TrendingDown className="h-3 w-3" />
                                                {pctFallenFromHigh > 0 ? '▼' : '▲'} {Math.abs(pctFallenFromHigh).toFixed(2)}% from High
                                            </span>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-gray-600 mt-1">
                                        = (High − CMP) × 100 / High
                                    </p>
                                </div>

                                {/* Low card */}
                                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <TrendingUp className="h-4 w-4 text-green-400" />
                                        <span className="text-xs text-gray-400">52-Week Low</span>
                                    </div>
                                    <p className="text-xl font-bold text-white">
                                        {details.low != null ? `₹${details.low.toLocaleString('en-IN')}` : '—'}
                                    </p>
                                    {pctGainedFromLow != null && (
                                        <div className="mt-2">
                                            <span className={cn(
                                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                                                pctGainedFromLow >= 0
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-red-500/20 text-red-400'
                                            )}>
                                                <TrendingUp className="h-3 w-3" />
                                                {pctGainedFromLow >= 0 ? '▲' : '▼'} {Math.abs(pctGainedFromLow).toFixed(2)}% from Low
                                            </span>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-gray-600 mt-1">
                                        = (CMP − Low) × 100 / Low
                                    </p>
                                </div>
                            </div>

                            {/* Market Cap / ROE / ROCE */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                                    <p className="text-[10px] text-gray-500 mb-1">Market Cap</p>
                                    <p className="text-sm font-bold text-white break-words">
                                        {details.market_cap ?? '—'}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                                    <p className="text-[10px] text-gray-500 mb-1">ROE</p>
                                    <p className={cn(
                                        'text-sm font-bold',
                                        details.roe ? 'text-blue-400' : 'text-white'
                                    )}>
                                        {details.roe ?? '—'}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                                    <p className="text-[10px] text-gray-500 mb-1">ROCE</p>
                                    <p className={cn(
                                        'text-sm font-bold',
                                        details.roce ? 'text-purple-400' : 'text-white'
                                    )}>
                                        {details.roce ?? '—'}
                                    </p>
                                </div>
                            </div>

                            {/* Company Description */}
                            {details.description && (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Building2 className="h-4 w-4 text-gray-400" />
                                        <span className="text-xs font-semibold text-gray-300">About the Company</span>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-6 hover:line-clamp-none transition-all cursor-pointer">
                                        {details.description}
                                    </p>
                                </div>
                            )}

                            {/* Formula note */}
                            <div className="flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                                <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-blue-300/80 leading-relaxed">
                                    Data sourced from <strong>screener.in</strong>.
                                    High/Low are 52-week figures. Percentages are relative to the current market price.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
