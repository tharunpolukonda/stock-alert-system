'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Bell, MoreHorizontal, Trash2, Loader2 } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
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
    const [isHovered, setIsHovered] = useState(false)
    const [loadingPrice, setLoadingPrice] = useState(false)
    const [livePrice, setLivePrice] = useState<number | null>(null)

    const isPositive = (stock.price_change || 0) >= 0
    // baseline_price is passed as current_price prop from parent currently
    const baselinePrice = stock.current_price || 0

    const percentageChange = livePrice
        ? ((livePrice - baselinePrice) / baselinePrice) * 100
        : 0

    const isLivePositive = percentageChange >= 0

    const handleTrackPrice = async () => {
        setLoadingPrice(true)
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company_name: stock.company_name }),
            })
            const result = await response.json()
            if (result.success) {
                setLivePrice(result.price)
            }
        } catch (error) {
            console.error("Failed to track price", error)
        } finally {
            setLoadingPrice(false)
        }
    }

    return (
        <div
            className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg transition-all hover:border-white/20 hover:bg-white/10"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-white truncate max-w-[180px]">{stock.company_name}</h3>
                        {stock.is_portfolio && (
                            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                                Portfolio
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-400">{stock.symbol}</p>
                    {stock.sector_name && (
                        <p className="text-xs text-gray-500 mt-1">Sector: {stock.sector_name}</p>
                    )}
                    {stock.is_portfolio && stock.shares_count && (
                        <p className="text-xs text-blue-400 mt-1">Shares: {stock.shares_count}</p>
                    )}
                </div>
                <div className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                    isPositive ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                )}>
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isPositive ? '+' : ''}{stock.price_change}%
                </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
                <div>
                    <p className="text-xs text-gray-500 mb-1">Baseline Price</p>
                    <div className="text-2xl font-bold text-white">
                        ₹{baselinePrice.toLocaleString()}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                    {/* Live Price (Top) */}
                    <div className="h-6">
                        {livePrice && (
                            <span className={cn(
                                "text-sm font-bold",
                                isLivePositive ? "text-green-400" : "text-red-400"
                            )}>
                                ₹{livePrice.toLocaleString()}
                            </span>
                        )}
                    </div>

                    {/* Track Button (Middle) */}
                    <button
                        onClick={handleTrackPrice}
                        disabled={loadingPrice}
                        className="text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-2"
                    >
                        {loadingPrice && <Loader2 className="h-3 w-3 animate-spin" />}
                        {loadingPrice ? 'Tracking...' : 'Track Price'}
                    </button>

                    {/* Percentage (Bottom) */}
                    <div className="h-6">
                        {livePrice && (
                            <span className={cn(
                                "text-xs font-medium flex items-center gap-1",
                                isLivePositive ? "text-green-400" : "text-red-400"
                            )}>
                                {isLivePositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {Math.abs(percentageChange).toFixed(2)}%
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
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

            <div className="absolute top-4 right-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                    onClick={() => onEdit?.(stock.id)}
                    className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                    title="Edit Alert"
                >
                    <Bell className="h-4 w-4" />
                </button>
                <button
                    onClick={() => onDelete?.(stock.id)} // This passes Alert ID (as stock.id is mapped to Alert ID in parent)
                    className="rounded-full bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                    title="Delete Alert & Stock"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}
