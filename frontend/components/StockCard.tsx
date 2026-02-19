'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Bell, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StockCardProps {
    stock: {
        id: string
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
    }
    onDelete?: (id: string) => void
    onEdit?: (id: string) => void
}

export function StockCard({ stock, onDelete, onEdit }: StockCardProps) {
    const [loadingPrice, setLoadingPrice] = useState(false)
    const [livePrice, setLivePrice] = useState<number | null>(null)

    const isPositive = (stock.price_change || 0) >= 0
    const baselinePrice = stock.current_price || 0

    const percentageChange = livePrice
        ? ((livePrice - baselinePrice) / baselinePrice) * 100
        : 0
    const isLivePositive = percentageChange >= 0

    const handleTrackPrice = async () => {
        setLoadingPrice(true)
        try {
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')
            const response = await fetch(`${apiBase}/api/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({ company_name: stock.company_name }),
            })
            const result = await response.json()
            if (result.success) {
                setLivePrice(result.price)
            }
        } catch (error) {
            console.error('Failed to track price', error)
        } finally {
            setLoadingPrice(false)
        }
    }

    return (
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg transition-all hover:border-white/20 hover:bg-white/10">

            {/* Action buttons — always visible on mobile, top-right */}
            <div className="absolute top-3 right-3 flex gap-1.5">
                <button
                    onClick={() => onEdit?.(stock.id)}
                    className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 active:bg-white/30"
                    title="Edit Alert"
                >
                    <Bell className="h-3.5 w-3.5" />
                </button>
                <button
                    onClick={() => onDelete?.(stock.id)}
                    className="rounded-full bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20 active:bg-red-500/30"
                    title="Delete Alert"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Stock name + badges */}
            <div className="pr-16">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <h3 className="text-base font-semibold text-white leading-tight">{stock.company_name}</h3>
                    {stock.is_portfolio && (
                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                            Portfolio
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
                    {livePrice && (
                        <span className={cn('text-sm font-bold', isLivePositive ? 'text-green-400' : 'text-red-400')}>
                            ₹{livePrice.toLocaleString()}
                        </span>
                    )}
                    <button
                        onClick={handleTrackPrice}
                        disabled={loadingPrice}
                        className="flex items-center gap-1.5 rounded-full bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-600/30 active:bg-blue-600/40 disabled:opacity-60"
                    >
                        {loadingPrice && <Loader2 className="h-3 w-3 animate-spin" />}
                        {loadingPrice ? 'Tracking...' : 'Track Price'}
                    </button>
                    {livePrice && (
                        <span className={cn('flex items-center gap-1 text-xs font-medium', isLivePositive ? 'text-green-400' : 'text-red-400')}>
                            {isLivePositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {Math.abs(percentageChange).toFixed(2)}%
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
        </div>
    )
}
