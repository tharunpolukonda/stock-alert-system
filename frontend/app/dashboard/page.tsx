'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StockCard } from '@/components/StockCard'
import { SearchBar } from '@/components/SearchBar'
import { AlertForm } from '@/components/AlertForm'
import { SectorModal } from '@/components/SectorModal'
import Image from 'next/image'
import {
    Plus, LogOut, Loader2, X, FolderPlus, Menu, BarChart3,
    RefreshCw, AlertTriangle, LayoutDashboard, Bell, TrendingUp, BookOpen
} from 'lucide-react'

/* ── Logout Confirmation Modal ── */
function LogoutConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onCancel}>
            <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#0a0a0f] p-6 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center mb-5">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
                        <AlertTriangle className="h-6 w-6 text-red-400" />
                    </div>
                    <h3 className="text-base font-bold text-white">Logout?</h3>
                    <p className="mt-1.5 text-sm text-gray-400">Are you sure you want to sign out of your account?</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors">Logout</button>
                </div>
            </div>
        </div>
    )
}

export default function Dashboard() {
    const [user, setUser] = useState<any>(null)
    const [stocks, setStocks] = useState<any[]>([])
    const [allStocks, setAllStocks] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showSectorModal, setShowSectorModal] = useState(false)
    const [showMobileMenu, setShowMobileMenu] = useState(false)
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [selectedStockId, setSelectedStockId] = useState<string | null>(null)
    const [searchResult, setSearchResult] = useState<any>(null)
    const [sectors, setSectors] = useState<any[]>([])
    const [selectedSector, setSelectedSector] = useState<string>('')
    const [editingAlert, setEditingAlert] = useState<any>(null)
    const [portfolioAnalytics, setPortfolioAnalytics] = useState({
        totalInvestment: 0,
        currentValue: 0,
        totalGain: 0,
        gainPercentage: 0
    })
    const [fetchingPrices, setFetchingPrices] = useState(false)

    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/')
                return
            }
            setUser(user)
            fetchStocks(user.id)
        }
        getUser()
    }, [supabase, router])

    const fetchStocks = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('user_alerts')
                .select(`
                    id,
                    baseline_price,
                    gain_threshold_percent,
                    loss_threshold_percent,
                    is_active,
                    is_portfolio,
                    shares_count,
                    stock:stocks (
                        id,
                        company_name,
                        symbol,
                        interest,
                        sector:sectors (
                            id,
                            name
                        )
                    )
                `)
                .eq('user_id', userId)

            if (error) throw error

            if (data) {
                const formattedStocks = data.map((alert: any) => ({
                    id: alert.id,
                    stock_id: alert.stock.id,
                    company_name: alert.stock.company_name,
                    symbol: alert.stock.symbol || 'NSE',
                    current_price: alert.baseline_price,
                    price_change: 0,
                    last_updated: new Date().toISOString(),
                    gain_threshold: alert.gain_threshold_percent,
                    loss_threshold: alert.loss_threshold_percent,
                    is_portfolio: alert.is_portfolio,
                    shares_count: alert.shares_count,
                    sector_id: alert.stock.sector?.id,
                    sector_name: alert.stock.sector?.name,
                    interest: alert.stock.interest || 'not-interested'
                }))
                setAllStocks(formattedStocks)
                filterStocks(formattedStocks, selectedSector)
            }
        } catch (error) {
            console.error('Error fetching stocks:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchSectors = async () => {
        try {
            const { data, error } = await supabase
                .from('sectors')
                .select('id, name')
                .order('name', { ascending: true })

            if (error) throw error
            setSectors(data || [])
        } catch (error) {
            console.error('Error fetching sectors:', error)
        }
    }

    const filterStocks = (stocksList: any[], sectorId: string) => {
        if (!sectorId) {
            setStocks(stocksList.filter(s => s.is_portfolio))
        } else {
            setStocks(stocksList.filter(s => s.sector_id === sectorId))
        }
    }

    const calculatePortfolioAnalytics = async () => {
        const portfolioStocks = allStocks.filter(s => s.is_portfolio && s.shares_count)

        if (portfolioStocks.length === 0) {
            setPortfolioAnalytics({ totalInvestment: 0, currentValue: 0, totalGain: 0, gainPercentage: 0 })
            return
        }

        setFetchingPrices(true)
        let totalInvested = 0
        let totalCurrent = 0

        try {
            for (const stock of portfolioStocks) {
                const invested = stock.current_price * stock.shares_count
                totalInvested += invested

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
                        totalCurrent += result.price * stock.shares_count
                    } else {
                        totalCurrent += invested
                    }
                } catch (error) {
                    console.error(`Failed to fetch price for ${stock.company_name}`, error)
                    totalCurrent += invested
                }
            }

            const gain = totalCurrent - totalInvested
            const gainPercent = totalInvested > 0 ? (gain / totalInvested) * 100 : 0

            setPortfolioAnalytics({
                totalInvestment: totalInvested,
                currentValue: totalCurrent,
                totalGain: gain,
                gainPercentage: gainPercent
            })
        } catch (error) {
            console.error('Error calculating portfolio analytics:', error)
        } finally {
            setFetchingPrices(false)
        }
    }

    useEffect(() => { fetchSectors() }, [])

    useEffect(() => {
        filterStocks(allStocks, selectedSector)
        calculatePortfolioAnalytics()
    }, [selectedSector, allStocks])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/')
    }

    const handleSearchResult = async (result: any) => {
        if (!result.success) {
            alert(`Could not find stock: ${result.error}`)
            return
        }
        setSearchResult(result)
    }

    const handleSaveAlert = async (alertData: any) => {
        if (!user) return

        try {
            let stockId = alertData.stock_id
            let stockName = alertData.company_name

            if (!stockId && stockName) {
                const { data: stockData, error: stockError } = await supabase
                    .from('stocks')
                    .upsert({
                        company_name: stockName,
                        symbol: 'NSE',
                        current_price: alertData.baseline_price,
                        sector_id: alertData.sector_id,
                        interest: alertData.interest || 'not-interested'
                    }, { onConflict: 'company_name' })
                    .select()
                    .single()

                if (stockError) throw stockError
                stockId = stockData.id
            } else if (stockId) {
                await supabase.from('stocks').update({
                    sector_id: alertData.sector_id,
                    interest: alertData.interest || 'not-interested'
                }).eq('id', stockId)
            }

            if (editingAlert) {
                const { error: updateError } = await supabase
                    .from('user_alerts')
                    .update({
                        baseline_price: alertData.baseline_price,
                        gain_threshold_percent: alertData.gain_threshold_percent,
                        loss_threshold_percent: alertData.loss_threshold_percent,
                        is_portfolio: alertData.is_portfolio,
                        shares_count: alertData.shares_count,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingAlert.id)
                    .eq('user_id', user.id)

                if (updateError) throw updateError
            } else {
                const { error: alertError } = await supabase
                    .from('user_alerts')
                    .insert({
                        user_id: user.id,
                        stock_id: stockId,
                        baseline_price: searchResult ? searchResult.price : alertData.baseline_price,
                        gain_threshold_percent: alertData.gain_threshold_percent,
                        loss_threshold_percent: alertData.loss_threshold_percent,
                        is_portfolio: alertData.is_portfolio,
                        shares_count: alertData.shares_count
                    })

                if (alertError) throw alertError
            }

            setShowAddModal(false)
            setSearchResult(null)
            setEditingAlert(null)
            fetchStocks(user.id)

        } catch (error: any) {
            console.error('Error saving alert:', error)
            alert(`Error saving alert: ${error.message}`)
        }
    }

    const handleEditAlert = (alertId: string) => {
        const alert = allStocks.find(s => s.id === alertId)
        if (alert) {
            setEditingAlert(alert)
            setShowAddModal(true)
        }
    }

    const handleChangeInterest = async (alertId: string, stockId: string) => {
        try {
            const stock = allStocks.find(s => s.id === alertId)
            if (!stock) return
            await supabase.from('stocks').update({ interest: 'interested' }).eq('id', stock.stock_id)
            fetchStocks(user.id)
        } catch (error) {
            console.error('Error changing interest:', error)
        }
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#020817] text-white">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    <p className="text-sm text-gray-400">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020817] text-white">

            {/* ── Top Navbar ── */}
            <header className="sticky top-0 z-40 border-b border-blue-500/10 bg-[#020817]/95 backdrop-blur-xl">
                <div className="mx-auto flex items-center justify-between px-4 py-3 sm:px-6">

                    {/* Left: Hamburger + Logo */}
                    <div className="flex items-center gap-3">
                        {/* Hamburger menu */}
                        <button
                            onClick={() => setShowMobileMenu(!showMobileMenu)}
                            className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-blue-400 hover:bg-blue-500/10 transition-colors"
                        >
                            <Menu className="h-5 w-5" />
                        </button>

                        {/* Hoox Logo */}
                        <Image
                            src="/assets/HooxMainLogo-removebg-preview.png"
                            alt="Hoox Logo"
                            width={100}
                            height={35}
                            className="h-8 w-auto drop-shadow-lg cursor-pointer"
                            onClick={() => router.push('/dashboard')}
                            priority
                        />
                    </div>

                    {/* Center: Search + Controls */}
                    <div className="hidden md:flex items-center gap-3 flex-1 max-w-2xl mx-6">
                        <div className="flex-1 min-w-0">
                            <SearchBar onSearchResult={handleSearchResult} />
                        </div>

                        <button
                            onClick={() => fetchStocks(user.id)}
                            className="flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        <button
                            onClick={() => setShowSectorModal(true)}
                            className="flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
                        >
                            <FolderPlus className="h-4 w-4" />
                            <span className="hidden lg:inline">Add Sector</span>
                        </button>

                        <button
                            onClick={() => router.push('/journaledger')}
                            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-105"
                            style={{ background: 'linear-gradient(90deg, #ef4444 50%, #22c55e 50%)' }}
                        >
                            <BookOpen className="h-4 w-4" />
                            <span className="hidden lg:inline">J&L</span>
                        </button>

                        <button
                            onClick={() => {
                                setSearchResult(null)
                                setEditingAlert(null)
                                setShowAddModal(true)
                            }}
                            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-blue-400 transition-all"
                        >
                            <Plus className="h-4 w-4" />
                            <span className="hidden lg:inline">Add Alert</span>
                        </button>
                    </div>

                    {/* Right: Logout */}
                    <div className="flex items-center gap-2">
                        {/* Mobile add button */}
                        <button
                            onClick={() => {
                                setSearchResult(null)
                                setEditingAlert(null)
                                setShowAddModal(true)
                            }}
                            className="md:hidden flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
                        >
                            <Plus className="h-4 w-4" />
                            Add
                        </button>

                        <button
                            onClick={() => setShowLogoutConfirm(true)}
                            className="rounded-full border border-red-500/20 bg-red-500/5 p-2 text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Logout"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Mobile search bar */}
                <div className="md:hidden px-4 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <SearchBar onSearchResult={handleSearchResult} />
                        </div>
                        <button
                            onClick={() => fetchStocks(user.id)}
                            className="rounded-full border border-blue-500/20 bg-blue-500/5 p-2 text-blue-400"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Slide-out Navigation Menu ── */}
            {showMobileMenu && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)}>
                    <div
                        className="absolute left-0 top-0 h-full w-72 border-r border-blue-500/10 bg-[#020817] p-6 shadow-2xl animate-slide-up"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Logo */}
                        <div className="mb-8 flex items-center justify-between">
                            <Image
                                src="/assets/HooxMainLogo-removebg-preview.png"
                                alt="Hoox Logo"
                                width={100}
                                height={35}
                                className="h-8 w-auto"
                            />
                            <button onClick={() => setShowMobileMenu(false)} className="text-gray-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Navigation Links */}
                        <nav className="space-y-2">
                            <button
                                onClick={() => { router.push('/dashboard'); setShowMobileMenu(false) }}
                                className="flex w-full items-center gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-blue-400 font-medium"
                            >
                                <LayoutDashboard className="h-5 w-5" />
                                Stock Watchlist
                            </button>
                            <button
                                onClick={() => setShowMobileMenu(false)}
                                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-gray-400 hover:bg-blue-500/5 hover:text-blue-400 transition-colors"
                            >
                                <Bell className="h-5 w-5" />
                                Alert History
                            </button>
                            <button
                                onClick={() => { router.push('/prctrendtracker'); setShowMobileMenu(false) }}
                                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-gray-400 hover:bg-blue-500/5 hover:text-blue-400 transition-colors"
                            >
                                <BarChart3 className="h-5 w-5" />
                                PrcTrendTracker
                            </button>
                            <button
                                onClick={() => { router.push('/journaledger'); setShowMobileMenu(false) }}
                                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-gray-400 hover:bg-blue-500/5 hover:text-blue-400 transition-colors"
                            >
                                <BookOpen className="h-5 w-5" />
                                Journal & Ledger
                            </button>
                        </nav>

                        {/* Divider */}
                        <div className="my-6 border-t border-blue-500/10" />

                        {/* Quick Actions */}
                        <div className="space-y-2">
                            <button
                                onClick={() => { setShowSectorModal(true); setShowMobileMenu(false) }}
                                className="flex w-full items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-blue-400 hover:bg-blue-500/10 transition-colors"
                            >
                                <FolderPlus className="h-5 w-5" />
                                Add Sector
                            </button>
                        </div>

                        {/* User info at bottom */}
                        <div className="absolute bottom-6 left-6 right-6">
                            <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-4">
                                <p className="text-xs text-gray-500">Logged in as</p>
                                <p className="truncate text-sm font-medium text-blue-400">{user?.email}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Main Content ── */}
            <main className="min-h-screen px-4 py-6 sm:px-6">

                {/* Title + Filter row */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-bold lg:text-2xl text-white">Stock Watchlist</h1>
                        <p className="text-sm text-gray-500">Monitor your stocks and manage alerts.</p>
                    </div>

                    <select
                        value={selectedSector}
                        onChange={(e) => setSelectedSector(e.target.value)}
                        className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-2.5 text-sm font-medium text-blue-400 cursor-pointer hover:bg-blue-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        style={{ colorScheme: 'dark' }}
                    >
                        <option value="" className="bg-[#020817] text-blue-400">Portfolio Stocks</option>
                        {sectors.map((sector) => (
                            <option key={sector.id} value={sector.id} className="bg-[#020817] text-blue-400">
                                {sector.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Portfolio Analytics with Bull and Bear */}
                {!selectedSector && allStocks.filter(s => s.is_portfolio).length > 0 && (
                    <div className="mb-6 relative">
                        {/* Bull on left */}
                        <div className="hidden lg:block absolute -left-4 top-1/2 -translate-y-1/2 z-10">
                            <div className="animate-float">
                                <Image
                                    src="/assets/bull_premium_1771778168693.png"
                                    alt="Bull"
                                    width={160}
                                    height={160}
                                    className="h-32 w-32 object-contain opacity-60 drop-shadow-2xl"
                                />
                            </div>
                        </div>

                        {/* Bear on right */}
                        <div className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                            <div className="animate-float-slow">
                                <Image
                                    src="/assets/bear_blue_premium_1771777968054.png"
                                    alt="Bear"
                                    width={160}
                                    height={160}
                                    className="h-32 w-32 object-contain opacity-60 drop-shadow-2xl"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:mx-28">
                            <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-600/10 to-blue-700/5 p-3 backdrop-blur-md">
                                <p className="text-[10px] text-gray-400 mb-0.5">Total Investment</p>
                                <p className="text-base font-bold text-white leading-tight">
                                    ₹{portfolioAnalytics.totalInvestment.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                            <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 p-3 backdrop-blur-md">
                                <p className="text-[10px] text-gray-400 mb-0.5">Current Value</p>
                                <p className="text-base font-bold text-white leading-tight">
                                    ₹{portfolioAnalytics.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                                {fetchingPrices && <p className="text-[10px] text-gray-500 mt-0.5">Updating...</p>}
                            </div>
                            <div className={`rounded-xl border p-3 backdrop-blur-md ${portfolioAnalytics.totalGain >= 0
                                ? 'border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5'
                                : 'border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-600/5'
                                }`}>
                                <p className="text-[10px] text-gray-400 mb-0.5">Gain / Loss</p>
                                <p className={`text-base font-bold leading-tight ${portfolioAnalytics.totalGain >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                    {portfolioAnalytics.totalGain >= 0 ? '+' : ''}₹{portfolioAnalytics.totalGain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                            <div className={`rounded-xl border p-3 backdrop-blur-md ${portfolioAnalytics.gainPercentage >= 0
                                ? 'border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5'
                                : 'border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-600/5'
                                }`}>
                                <p className="text-[10px] text-gray-400 mb-0.5">Return %</p>
                                <p className={`text-base font-bold leading-tight ${portfolioAnalytics.gainPercentage >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                    {portfolioAnalytics.gainPercentage >= 0 ? '+' : ''}{portfolioAnalytics.gainPercentage.toFixed(2)}%
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Search Result Preview */}
                {searchResult && !showAddModal && (
                    <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 relative animate-slide-up">
                        <button
                            onClick={() => setSearchResult(null)}
                            className="absolute top-3 right-3 text-gray-400 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">{searchResult.company_name}</h3>
                                <p className="text-2xl font-bold mt-1 text-blue-400">₹{searchResult.price?.toLocaleString()}</p>
                            </div>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="self-start rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-blue-400 sm:self-auto transition-all"
                            >
                                Set Alert
                            </button>
                        </div>
                    </div>
                )}

                {/* Stock Grid */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {stocks.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-blue-500/10 py-16 text-center">
                            <div className="mb-4 rounded-full bg-blue-500/5 p-4">
                                <Bell className="h-8 w-8 text-blue-500/40" />
                            </div>
                            <h3 className="text-lg font-medium text-white">No alerts configured</h3>
                            <p className="mt-1 text-sm text-gray-400">Search for a stock above to get started.</p>
                        </div>
                    ) : (
                        stocks.map((stock) => (
                            <StockCard
                                key={stock.id}
                                stock={stock}
                                onEdit={handleEditAlert}
                                onChangeInterest={handleChangeInterest}
                                onDelete={async (id) => {
                                    const { error: alertError } = await supabase.from('user_alerts').delete().eq('id', id)
                                    if (!alertError && stock.stock_id) {
                                        await supabase.from('stocks').delete().eq('id', stock.stock_id)
                                    }
                                    fetchStocks(user.id)
                                }}
                            />
                        ))
                    )}
                </div>
            </main>

            {/* Add/Edit Alert Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center p-4">
                    <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <AlertForm
                            stockId={editingAlert?.stock_id || selectedStockId || ''}
                            companyName={editingAlert?.company_name || searchResult?.company_name}
                            initialBaseline={editingAlert?.current_price || searchResult?.price || 0}
                            initialGain={editingAlert?.gain_threshold || 10}
                            initialLoss={editingAlert?.loss_threshold || 5}
                            initialSectorId={editingAlert?.sector_id || ''}
                            initialIsPortfolio={editingAlert?.is_portfolio || false}
                            initialSharesCount={editingAlert?.shares_count || 0}
                            initialInterest={editingAlert?.interest || 'not-interested'}
                            onSave={handleSaveAlert}
                            onCancel={() => {
                                setShowAddModal(false)
                                setSearchResult(null)
                                setEditingAlert(null)
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Sector Modal */}
            {showSectorModal && (
                <SectorModal
                    onClose={() => setShowSectorModal(false)}
                    onSectorAdded={() => { fetchSectors() }}
                />
            )}

            {/* Logout Confirmation */}
            {showLogoutConfirm && (
                <LogoutConfirmModal
                    onConfirm={handleSignOut}
                    onCancel={() => setShowLogoutConfirm(false)}
                />
            )}
        </div>
    )
}
