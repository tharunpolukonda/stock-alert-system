'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, Pencil, Trash2, Loader2, BarChart3, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RatiosModal } from '@/components/RatiosModal'

interface StockCardProps {
    stock: {
        id: string
        stock_id?: string
        company_name: string
        symbol: string
        current_price?: number
        price_change?: number
        last_updated?: string
        gain_threshold?: number
        loss_threshold?: number
        is_portfolio?: boolean
        shares_count?: number
        sector_name?: string
        interest?: 'interested' | 'not-interested'
    }
    livePrice?: number | null
    return1Day?: number | null
    onDelete?: (id: string) => void
    onEdit?: (id: string) => void
    onChangeInterest?: (id: string, stockId: string) => void
}

/** Inline confirmation popup for destructive delete action */
function DeleteConfirmModal({
    companyName,
    onConfirm,
    onCancel,
}: {
    companyName: string
    onConfirm: () => void
    onCancel: () => void
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
            onClick={onCancel}
        >
            <div
                className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#0d0d0d] p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon + heading */}
                <div className="flex flex-col items-center text-center mb-5">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
                        <AlertTriangle className="h-6 w-6 text-red-400" />
                    </div>
                    <h3 className="text-base font-bold text-white">Delete Alert?</h3>
                    <p className="mt-1.5 text-sm text-gray-400">
                        This will permanently remove{' '}
                        <span className="font-semibold text-white">{companyName}</span>{' '}
                        from your watchlist.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 active:bg-white/15 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 active:bg-red-800 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    )
}

export function StockCard({ stock, livePrice: propLivePrice, return1Day, onDelete, onEdit, onChangeInterest }: StockCardProps) {
    const router = useRouter()
    const [showRatios, setShowRatios] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showInterestConfirm, setShowInterestConfirm] = useState(false)

    const baselinePrice = stock.current_price || 0
    const [internalLivePrice, setInternalLivePrice] = useState<number | null>(null)
    const [internalReturn1Day, setInternalReturn1Day] = useState<number | null>(null)
    const [isTracking, setIsTracking] = useState(false)

    const livePrice = internalLivePrice ?? propLivePrice ?? null
    const effectiveReturn1Day = internalReturn1Day ?? return1Day ?? null

    const percentageChange = livePrice
        ? ((livePrice - baselinePrice) / baselinePrice) * 100
        : 0
    const isLivePositive = percentageChange >= 0

    const handleTrackPrice = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsTracking(true)
        try {
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')

            // 1. Fetch current price from search API (POST)
            const res = await fetch(`${apiBase}/api/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company_name: stock.company_name }),
            })
            const data = await res.json()
            if (data.success && data.price) {
                setInternalLivePrice(data.price)

                // 2. Fetch historical data for Return1Day% (Multi-step Screener Flow)
                try {
                    // Step A: Search for slug
                    const searchRes = await fetch(`/api/screener?action=search&q=${encodeURIComponent(stock.company_name)}`)
                    const searchData = await searchRes.json()
                    if (Array.isArray(searchData) && searchData.length > 0) {
                        const url = searchData[0].url || ''
                        const slug = url.replace(/^\/|\/$/g, '').split('/')[1] || ''

                        if (slug) {
                            // Step B: Get companyId
                            const idRes = await fetch(`/api/screener?action=companyId&slug=${encodeURIComponent(slug)}`)
                            const idData = await idRes.json()

                            if (idData.companyId) {
                                // Step C: Fetch chart data
                                const chartRes = await fetch(`/api/screener?action=chart&id=${idData.companyId}&days=7`)
                                const chartData = await chartRes.json()
                                const datasets = chartData.datasets || chartData

                                if (Array.isArray(datasets) && datasets[0]?.values) {
                                    const priceEntries = datasets[0].values
                                        .map((e: [string, any]) => ({ date: e[0], price: Number(e[1]) }))
                                        .filter((e: { date: string; price: number }) => !isNaN(e.price) && e.price > 0)
                                        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

                                    if (priceEntries.length >= 2) {
                                        const prevClose = priceEntries[1].price
                                        const r1d = ((data.price - prevClose) / prevClose) * 100
                                        setInternalReturn1Day(r1d)
                                    }
                                }
                            }
                        }
                    }
                } catch (scrErr) {
                    console.error('Error fetching Return1Day:', scrErr)
                }
            }
        } catch (err) {
            console.error('Error tracking price:', err)
        } finally {
            setIsTracking(false)
        }
    }

    const handleDeleteConfirmed = () => {
        setShowDeleteConfirm(false)
        onDelete?.(stock.id)
    }

    const cmp = livePrice ?? baselinePrice

    const isInterested = stock.interest === 'interested' || stock.is_portfolio
    const cardBorderClass = isInterested
        ? 'border-blue-500/20 hover:border-blue-500/30'
        : 'border-gray-500/20 hover:border-gray-500/30'
    const cardBgClass = isInterested
        ? 'bg-white/5 hover:bg-white/10'
        : 'bg-gray-900/40 hover:bg-gray-900/60'

    return (
        <>
            <div
                className={`relative overflow-hidden rounded-xl border ${cardBorderClass} ${cardBgClass} p-5 backdrop-blur-lg transition-all cursor-pointer`}
                onClick={() => router.push(`/fulldetails/${stock.id}`)}
            >

                {/* Action buttons */}
                <div className="absolute top-3 right-3 flex gap-1.5">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit?.(stock.id) }}
                        className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 active:bg-white/30"
                        title="Edit Alert"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true) }}
                        className="rounded-full bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20 active:bg-red-500/30"
                        title="Delete Alert"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Stock name + badges */}
                <div className="pr-16">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <h3 className={`text-base font-semibold leading-tight ${isInterested ? 'text-white' : 'text-gray-400'}`}>{stock.company_name}</h3>
                        {stock.is_portfolio && (
                            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                                Portfolio
                            </span>
                        )}
                        {isInterested && !stock.is_portfolio && (
                            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-300">
                                Interested
                            </span>
                        )}
                        {!isInterested && (
                            <span className="rounded-full bg-gray-500/20 px-2 py-0.5 text-xs font-medium text-gray-400">
                                Not-Interested
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-400">{stock.symbol}</p>
                    {stock.sector_name && (
                        <p className="text-xs text-gray-500 mt-0.5">Sector: {stock.sector_name}</p>
                    )}
                    {stock.is_portfolio && stock.shares_count && (
                        <p className="text-xs text-blue-400 mt-0.5">Shares: {stock.shares_count}</p>
                    )}
                </div>

                {/* Price row */}
                <div className="mt-4 flex items-end justify-between">
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Baseline Price</p>
                        <div className="text-2xl font-bold text-white">₹{baselinePrice.toLocaleString()}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        {livePrice != null ? (
                            <>
                                <div className="flex items-center gap-1.5">
                                    <p className="text-xs text-gray-500">CMP</p>
                                    <span className={cn('text-sm font-bold', isLivePositive ? 'text-green-400' : 'text-red-400')}>
                                        ₹{livePrice.toLocaleString()}
                                    </span>
                                </div>
                                <span className={cn('flex items-center gap-1 text-xs font-medium', isLivePositive ? 'text-green-400' : 'text-red-400')}>
                                    {isLivePositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                    {Math.abs(percentageChange).toFixed(2)}%
                                </span>
                            </>
                        ) : (
                            <button
                                onClick={handleTrackPrice}
                                disabled={isTracking}
                                className="flex items-center gap-1.5 rounded-lg bg-cyan-600/20 px-3 py-1.5 text-xs font-bold text-cyan-400 hover:bg-cyan-600/30 active:bg-cyan-600/40 transition-colors disabled:opacity-50"
                            >
                                {isTracking ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
                                Track Price
                            </button>
                        )}
                        {effectiveReturn1Day != null && (
                            <span className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                effectiveReturn1Day >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                            )}>
                                {effectiveReturn1Day >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                Return1Day: {effectiveReturn1Day >= 0 ? '+' : ''}{effectiveReturn1Day.toFixed(2)}%
                            </span>
                        )}
                    </div>
                </div>

                {/* Thresholds */}
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
                    <div>
                        <p className="text-xs text-gray-400 mb-1">Gain Threshold</p>
                        <p className="text-sm font-semibold text-green-400 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> +{stock.gain_threshold}%
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 mb-1">Loss Threshold</p>
                        <p className="text-sm font-semibold text-red-400 flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" /> -{stock.loss_threshold}%
                        </p>
                    </div>
                </div>

                {/* Other Ratios button */}
                <div className="mt-3 border-t border-white/5 pt-3 flex gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowRatios(true) }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600/15 px-3 py-2 text-xs font-medium text-purple-400 hover:bg-purple-600/25 active:bg-purple-600/35 transition-colors"
                    >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Other Ratios
                    </button>
                    {!isInterested && onChangeInterest && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowInterestConfirm(true) }}
                            className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600/15 px-3 py-2 text-xs font-medium text-blue-400 hover:bg-blue-600/25 active:bg-blue-600/35 transition-colors"
                        >
                            Chng2Interested
                        </button>
                    )}
                </div>
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <DeleteConfirmModal
                    companyName={stock.company_name}
                    onConfirm={handleDeleteConfirmed}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}

            {/* Ratios Popup */}
            {showRatios && (
                <RatiosModal
                    companyName={stock.company_name}
                    cmp={cmp}
                    onClose={() => setShowRatios(false)}
                />
            )}

            {/* Change to Interested Confirmation */}
            {showInterestConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
                    onClick={() => setShowInterestConfirm(false)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl border border-blue-500/30 bg-[#0d0d0d] p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col items-center text-center mb-5">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15">
                                <TrendingUp className="h-6 w-6 text-blue-400" />
                            </div>
                            <h3 className="text-base font-bold text-white">Change to Interested?</h3>
                            <p className="mt-1.5 text-sm text-gray-400">
                                Mark <span className="font-semibold text-white">{stock.company_name}</span> as Interested? Alerts will be activated for this company.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowInterestConfirm(false)}
                                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 active:bg-white/15 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowInterestConfirm(false)
                                    onChangeInterest?.(stock.id, stock.stock_id || '')
                                }}
                                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
