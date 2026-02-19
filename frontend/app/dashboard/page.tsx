'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StockCard } from '@/components/StockCard'
import { SearchBar } from '@/components/SearchBar'
import { AlertForm } from '@/components/AlertForm'
import { SectorModal } from '@/components/SectorModal'
import { Plus, LogOut, LayoutDashboard, Bell, Loader2, X, FolderPlus, Menu } from 'lucide-react'

export default function Dashboard() {
    const [user, setUser] = useState<any>(null)
    const [stocks, setStocks] = useState<any[]>([])
    const [allStocks, setAllStocks] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showSectorModal, setShowSectorModal] = useState(false)
    const [showMobileMenu, setShowMobileMenu] = useState(false)
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
                    sector_name: alert.stock.sector?.name
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
                        sector_id: alertData.sector_id
                    }, { onConflict: 'company_name' })
                    .select()
                    .single()

                if (stockError) throw stockError
                stockId = stockData.id
            } else if (stockId) {
                await supabase.from('stocks').update({ sector_id: alertData.sector_id }).eq('id', stockId)
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

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-black text-white">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black text-white">

            {/* ── Desktop Sidebar ── */}
            <aside className="fixed left-0 top-0 hidden h-full w-64 border-r border-white/10 bg-black p-6 lg:flex lg:flex-col">
                <div className="mb-8 flex items-center gap-2 text-xl font-bold text-white">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                        <LayoutDashboard className="h-5 w-5" />
                    </div>
                    Dashboard
                </div>

                <nav className="space-y-2">
                    <button className="flex w-full items-center gap-3 rounded-lg bg-white/10 px-4 py-2 text-white">
                        <LayoutDashboard className="h-5 w-5" />
                        Stock Watchlist
                    </button>
                    <button className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-gray-400 hover:bg-white/5 hover:text-white">
                        <Bell className="h-5 w-5" />
                        Alert History
                    </button>
                </nav>

                <div className="mt-auto">
                    <div className="mb-4 rounded-lg bg-gray-900 p-4">
                        <p className="text-xs text-gray-400">Logged in as</p>
                        <p className="truncate text-sm font-medium text-white">{user?.email}</p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent py-2 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* ── Mobile Top Nav ── */}
            <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-black/90 px-4 py-3 backdrop-blur-md lg:hidden">
                <div className="flex items-center gap-2 text-base font-bold">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                        <LayoutDashboard className="h-4 w-4" />
                    </div>
                    Dashboard
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setSearchResult(null)
                            setEditingAlert(null)
                            setShowAddModal(true)
                        }}
                        className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
                    >
                        <Plus className="h-4 w-4" />
                        Add
                    </button>
                    <button
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                        className="rounded-lg border border-white/10 p-2 text-gray-400"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                </div>
            </header>

            {/* ── Mobile Slide-down Menu ── */}
            {showMobileMenu && (
                <div className="fixed inset-0 z-50 bg-black/80 lg:hidden" onClick={() => setShowMobileMenu(false)}>
                    <div
                        className="absolute right-0 top-0 h-full w-72 border-l border-white/10 bg-black p-6"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="mb-6 flex items-center justify-between">
                            <span className="font-bold text-white">Menu</span>
                            <button onClick={() => setShowMobileMenu(false)} className="text-gray-400">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="mb-6 rounded-lg bg-gray-900 p-4">
                            <p className="text-xs text-gray-400">Logged in as</p>
                            <p className="truncate text-sm font-medium text-white">{user?.email}</p>
                        </div>
                        <div className="space-y-2">
                            <button
                                onClick={() => { setShowSectorModal(true); setShowMobileMenu(false) }}
                                className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white"
                            >
                                <FolderPlus className="h-5 w-5" />
                                Add Sector
                            </button>
                            <button
                                onClick={handleSignOut}
                                className="flex w-full items-center gap-3 rounded-lg border border-white/10 px-4 py-3 text-red-400"
                            >
                                <LogOut className="h-5 w-5" />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Main Content ── */}
            <main className="min-h-screen p-4 lg:p-6 lg:pl-72">
                {/* Header row */}
                <div className="mb-6 flex flex-col gap-4">
                    <div>
                        <h1 className="text-xl font-bold lg:text-2xl">Stock Watchlist</h1>
                        <p className="text-sm text-gray-400">Monitor your stocks and manage alerts.</p>
                    </div>

                    {/* Controls row — scrollable on mobile */}
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={selectedSector}
                            onChange={(e) => setSelectedSector(e.target.value)}
                            className="rounded-full border border-white/10 bg-black px-3 py-2 text-sm font-medium text-white"
                            style={{ colorScheme: 'dark' }}
                        >
                            <option value="" className="bg-black text-white">Portfolio Stocks</option>
                            {sectors.map((sector) => (
                                <option key={sector.id} value={sector.id} className="bg-black text-white">
                                    {sector.name}
                                </option>
                            ))}
                        </select>

                        <div className="flex-1 min-w-0">
                            <SearchBar onSearchResult={handleSearchResult} />
                        </div>

                        <button
                            onClick={() => fetchStocks(user.id)}
                            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
                            title="Refresh"
                        >
                            <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>

                        {/* Add Sector — hidden on mobile (use menu) */}
                        <button
                            onClick={() => setShowSectorModal(true)}
                            className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
                        >
                            <FolderPlus className="h-4 w-4" />
                            Add Sector
                        </button>

                        {/* Add Alert — hidden on mobile (in sticky header) */}
                        <button
                            onClick={() => {
                                setSearchResult(null)
                                setEditingAlert(null)
                                setShowAddModal(true)
                            }}
                            className="hidden sm:flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4" />
                            Add Alert
                        </button>
                    </div>
                </div>

                {/* Portfolio Analytics */}
                {!selectedSector && allStocks.filter(s => s.is_portfolio).length > 0 && (
                    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4 backdrop-blur-md">
                            <p className="text-xs text-gray-400 mb-1">Total Investment</p>
                            <p className="text-lg font-bold text-white leading-tight">
                                ₹{portfolioAnalytics.totalInvestment.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4 backdrop-blur-md">
                            <p className="text-xs text-gray-400 mb-1">Current Value</p>
                            <p className="text-lg font-bold text-white leading-tight">
                                ₹{portfolioAnalytics.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                            {fetchingPrices && <p className="text-xs text-gray-500 mt-1">Updating...</p>}
                        </div>
                        <div className={`rounded-xl border border-white/10 p-4 backdrop-blur-md ${portfolioAnalytics.totalGain >= 0
                            ? 'bg-gradient-to-br from-green-500/10 to-green-600/5'
                            : 'bg-gradient-to-br from-red-500/10 to-red-600/5'
                            }`}>
                            <p className="text-xs text-gray-400 mb-1">Gain / Loss</p>
                            <p className={`text-lg font-bold leading-tight ${portfolioAnalytics.totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {portfolioAnalytics.totalGain >= 0 ? '+' : ''}₹{portfolioAnalytics.totalGain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className={`rounded-xl border border-white/10 p-4 backdrop-blur-md ${portfolioAnalytics.gainPercentage >= 0
                            ? 'bg-gradient-to-br from-green-500/10 to-green-600/5'
                            : 'bg-gradient-to-br from-red-500/10 to-red-600/5'
                            }`}>
                            <p className="text-xs text-gray-400 mb-1">Return %</p>
                            <p className={`text-lg font-bold leading-tight ${portfolioAnalytics.gainPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {portfolioAnalytics.gainPercentage >= 0 ? '+' : ''}{portfolioAnalytics.gainPercentage.toFixed(2)}%
                            </p>
                        </div>
                    </div>
                )}

                {/* Search Result Preview */}
                {searchResult && !showAddModal && (
                    <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 relative">
                        <button
                            onClick={() => setSearchResult(null)}
                            className="absolute top-3 right-3 text-gray-400 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-lg font-bold">{searchResult.company_name}</h3>
                                <p className="text-2xl font-bold mt-1">₹{searchResult.price?.toLocaleString()}</p>
                            </div>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="self-start rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:self-auto"
                            >
                                Set Alert
                            </button>
                        </div>
                    </div>
                )}

                {/* Stock Grid */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {stocks.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                            <div className="mb-4 rounded-full bg-white/5 p-4">
                                <Bell className="h-8 w-8 text-gray-500" />
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
        </div>
    )
}
