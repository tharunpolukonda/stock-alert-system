'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StockCard } from '@/components/StockCard'
import { SearchBar } from '@/components/SearchBar'
import { AlertForm } from '@/components/AlertForm'
import { Plus, LogOut, LayoutDashboard, Bell, Loader2, X } from 'lucide-react'

export default function Dashboard() {
    const [user, setUser] = useState<any>(null)
    const [stocks, setStocks] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [selectedStockId, setSelectedStockId] = useState<string | null>(null)
    const [searchResult, setSearchResult] = useState<any>(null)

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
            // In a real app, join with alerts table to get active alerts
            // For now, we fetch alerts which contain stock info
            const { data, error } = await supabase
                .from('user_alerts')
                .select(`
          id,
          baseline_price,
          gain_threshold_percent,
          loss_threshold_percent,
          is_active,
          stock:stocks (
            id,
            company_name,
            symbol
          )
        `)
                .eq('user_id', userId)

            if (error) throw error

            if (data) {
                // Transform data for StockCard
                const formattedStocks = data.map((alert: any) => ({
                    id: alert.id, // Alert ID (for deletion)
                    stock_id: alert.stock.id, // Stock ID (for cascade deletion)
                    company_name: alert.stock.company_name,
                    symbol: alert.stock.symbol || 'NSE',
                    current_price: alert.baseline_price, // Initially show baseline, track button gets live
                    price_change: 0, // Placeholder
                    last_updated: new Date().toISOString(),
                    gain_threshold: alert.gain_threshold_percent,
                    loss_threshold: alert.loss_threshold_percent
                }))
                setStocks(formattedStocks)
            }
        } catch (error) {
            console.error('Error fetching stocks:', error)
        } finally {
            setLoading(false)
        }
    }

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
        // Removed setShowAddModal(true) - User wants to just see the result first
    }

    const handleSaveAlert = async (alertData: any) => {
        if (!user) return

        try {
            // 1. Ensure stock exists in stocks table
            let stockId = alertData.stock_id
            let stockName = alertData.company_name

            // If we don't have an ID but have a name (from search), create/get the stock
            if (!stockId && stockName) {
                const { data: stockData, error: stockError } = await supabase
                    .from('stocks')
                    .upsert({
                        company_name: stockName,
                        symbol: 'NSE', // Default
                        current_price: alertData.baseline_price
                    }, { onConflict: 'company_name' })
                    .select()
                    .single()

                if (stockError) throw stockError
                stockId = stockData.id
            }

            // 2. Create Alert
            const { error: alertError } = await supabase
                .from('user_alerts')
                .insert({
                    user_id: user.id,
                    stock_id: stockId,
                    baseline_price: searchResult ? searchResult.price : alertData.baseline_price,
                    gain_threshold_percent: alertData.gain_threshold_percent,
                    loss_threshold_percent: alertData.loss_threshold_percent
                })

            if (alertError) throw alertError

            // Refresh list
            setShowAddModal(false)
            setSearchResult(null)
            fetchStocks(user.id)

        } catch (error: any) {
            console.error('Error saving alert:', error)
            alert(`Error saving alert: ${error.message}`)
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
            {/* Sidebar / Navigation */}
            <aside className="fixed left-0 top-0 hidden h-full w-64 border-r border-white/10 bg-black p-6 lg:block">
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

                <div className="absolute bottom-6 left-6 right-6">
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

            {/* Main Content */}
            <main className="min-h-screen p-6 lg:pl-72">
                <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Stock Watchlist</h1>
                        <p className="text-gray-400">Monitor your favorite stocks and manage alerts.</p>
                    </div>

                    <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row">
                        <SearchBar onSearchResult={handleSearchResult} />
                        <button
                            onClick={() => fetchStocks(user.id)}
                            className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-medium text-white transition-colors hover:bg-white/10"
                            title="Refresh Prices"
                        >
                            <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        <button
                            onClick={() => {
                                setSearchResult(null)
                                setShowAddModal(true)
                            }}
                            className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4" />
                            Add Alert
                        </button>
                    </div>
                </div>

                {/* Search Result Preview */}
                {searchResult && !showAddModal && (
                    <div className="mb-8 rounded-xl border border-blue-500/30 bg-blue-500/10 p-6 backdrop-blur-md relative">
                        <button
                            onClick={() => setSearchResult(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold">{searchResult.company_name}</h3>
                                <p className="text-3xl font-bold mt-2">₹{searchResult.price?.toLocaleString()}</p>
                            </div>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
                            >
                                Set Alert
                            </button>
                        </div>
                    </div>
                )}

                {/* Stock Grid */}
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {stocks.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-20 text-center">
                            <div className="mb-4 rounded-full bg-white/5 p-4">
                                <Bell className="h-8 w-8 text-gray-500" />
                            </div>
                            <h3 className="text-lg font-medium text-white">No alerts configured</h3>
                            <p className="mt-1 text-gray-400">Search for a stock above to get started.</p>
                        </div>
                    ) : (
                        stocks.map((stock) => (
                            <StockCard
                                key={stock.id}
                                stock={stock}
                                onDelete={async (id) => {
                                    // 1. Delete ALERT
                                    const { error: alertError } = await supabase.from('user_alerts').delete().eq('id', id)

                                    // 2. Delete STOCK (using stock_id stored in the stock object)
                                    // Note: 'stock' variable is available in this closure
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

            {/* Add Alert Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md">
                        <AlertForm
                            stockId={selectedStockId || ''}
                            companyName={searchResult?.company_name}
                            initialBaseline={searchResult?.price || 0}
                            onSave={handleSaveAlert}
                            onCancel={() => {
                                setShowAddModal(false)
                                setSearchResult(null)
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
