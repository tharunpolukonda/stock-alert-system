'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
    Menu, LayoutDashboard, Bell, BarChart3, BookOpen, LogOut, X,
    Loader2, TrendingUp, TrendingDown, ChevronDown, ShoppingCart, DollarSign,
    History, AlertTriangle, CheckSquare, Square, Search
} from 'lucide-react'

/* ─── Types ─── */
interface StockForJL {
    alert_id: string
    stock_id: string
    company_name: string
    baseline_price: number
    shares_count: number
    is_portfolio: boolean
    interest: string
    sector_id?: string
    sector_name?: string
    is_invested_previous?: boolean
    no_trans_records?: number
}

interface Transaction {
    id: string
    stock_id: string
    company_name?: string
    transaction_type: 'buy' | 'sell'
    transaction_price: number
    num_shares: number
    previous_baseline_price: number
    updated_baseline_price: number
    previous_shares_count: number
    updated_shares_count: number
    profit_loss: number
    profit_loss_per_share: number
    created_at: string
}

/* ─── Page ─── */
export default function JournalLedger() {
    const router = useRouter()
    const supabase = createClient()

    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [sectors, setSectors] = useState<{ id: string; name: string }[]>([])
    const [selectedSector, setSelectedSector] = useState('')
    const [stocks, setStocks] = useState<StockForJL[]>([])
    const [pastInvestedStocks, setPastInvestedStocks] = useState<StockForJL[]>([])
    const [showNavMenu, setShowNavMenu] = useState(false)

    // LoadPast-Invested checkbox
    const [loadPastInvested, setLoadPastInvested] = useState(false)

    // Buy/Sell modals
    const [buyStock, setBuyStock] = useState<StockForJL | null>(null)
    const [sellStock, setSellStock] = useState<StockForJL | null>(null)
    const [txPrice, setTxPrice] = useState(0)
    const [txShares, setTxShares] = useState(0)
    const [txLoading, setTxLoading] = useState(false)

    // Convert to portfolio flow
    const [convertStock, setConvertStock] = useState<StockForJL | null>(null)

    // Track transactions
    const [showTrackPopup, setShowTrackPopup] = useState(false)
    const [trackMode, setTrackMode] = useState<'overall' | 'single' | 'sector' | null>(null)
    const [trackCompanyName, setTrackCompanyName] = useState('')
    const [trackSectorId, setTrackSectorId] = useState('')
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [showTransactions, setShowTransactions] = useState(false)
    const [txFetching, setTxFetching] = useState(false)

    // Company name autocomplete
    const [companySuggestions, setCompanySuggestions] = useState<{ id: string; company_name: string }[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)

    // Profit/Loss Booked
    const [profitBooked, setProfitBooked] = useState(0)
    const [lossBooked, setLossBooked] = useState(0)
    const [profitDetails, setProfitDetails] = useState<{ company_name: string; amount: number }[]>([])
    const [lossDetails, setLossDetails] = useState<{ company_name: string; amount: number }[]>([])
    const [showProfitPopup, setShowProfitPopup] = useState(false)
    const [showLossPopup, setShowLossPopup] = useState(false)

    /* ─── Auth ─── */
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/'); return }
            setUser(user)
            setLoading(false)
        }
        getUser()
    }, [supabase, router])

    /* ─── Fetch sectors ─── */
    useEffect(() => {
        const fetchSectors = async () => {
            const { data } = await supabase.from('sectors').select('id, name').order('name', { ascending: true })
            if (data) setSectors(data)
        }
        fetchSectors()
    }, [supabase])

    /* ─── Fetch stocks based on filter ─── */
    useEffect(() => {
        if (!user) { setStocks([]); setPastInvestedStocks([]); return }
        // Require a filter selection unless using special filters
        const specialFilters = ['portfolio_stocks', 'invested_sold', 'interested_not_portfolio']
        if (!selectedSector && !specialFilters.includes(selectedSector)) { setStocks([]); setPastInvestedStocks([]); return }

        const fetchStocks = async () => {
            // Fetch all user alerts with stock + sector + transaction_records
            const { data: alertsData } = await supabase
                .from('user_alerts')
                .select(`
                    id, baseline_price, is_portfolio, shares_count,
                    stock:stocks (id, company_name, interest, sector:sectors (id, name))
                `)
                .eq('user_id', user.id)

            // Fetch transaction records for this user
            const { data: txRecords } = await supabase
                .from('transaction_records')
                .select('stock_id, is_invested_previous, no_trans_records')
                .eq('user_id', user.id)

            const txMap = new Map<string, { is_invested_previous: boolean; no_trans_records: number }>()
            if (txRecords) {
                txRecords.forEach((r: any) => {
                    txMap.set(r.stock_id, { is_invested_previous: r.is_invested_previous, no_trans_records: r.no_trans_records })
                })
            }

            if (alertsData) {
                const allMapped = alertsData.map((a: any) => {
                    const txInfo = txMap.get(a.stock.id)
                    return {
                        alert_id: a.id,
                        stock_id: a.stock.id,
                        company_name: a.stock.company_name,
                        baseline_price: a.baseline_price,
                        shares_count: a.shares_count || 0,
                        is_portfolio: a.is_portfolio,
                        interest: a.stock.interest || 'not-interested',
                        sector_id: a.stock.sector?.id,
                        sector_name: a.stock.sector?.name,
                        is_invested_previous: txInfo?.is_invested_previous || false,
                        no_trans_records: txInfo?.no_trans_records || 0,
                    }
                })

                let portfolioFiltered: StockForJL[] = []
                let pastInvested: StockForJL[] = []

                if (selectedSector === 'portfolio_stocks') {
                    // Show all portfolio companies
                    portfolioFiltered = allMapped.filter((s: StockForJL) => s.is_portfolio)
                } else if (selectedSector === 'invested_sold') {
                    // Companies: not-portfolio AND is_invested_previous=true AND no_trans_records>0
                    pastInvested = allMapped.filter((s: StockForJL) =>
                        !s.is_portfolio && s.is_invested_previous && (s.no_trans_records || 0) > 0
                    )
                } else if (selectedSector === 'interested_not_portfolio') {
                    // Companies: not-portfolio AND interested AND is_invested_previous=false AND no_trans_records=0
                    portfolioFiltered = allMapped.filter((s: StockForJL) =>
                        !s.is_portfolio && s.interest === 'interested' && !s.is_invested_previous && (s.no_trans_records || 0) === 0
                    )
                } else {
                    // Sector-based: filter by sector, show only portfolio by default
                    const sectorStocks = allMapped.filter((s: StockForJL) => s.sector_id === selectedSector)
                    portfolioFiltered = sectorStocks.filter((s: StockForJL) => s.is_portfolio)

                    // If LoadPast-Invested is checked, also load past-invested
                    if (loadPastInvested) {
                        pastInvested = sectorStocks.filter((s: StockForJL) =>
                            !s.is_portfolio && (s.is_invested_previous || (s.no_trans_records || 0) > 0)
                        )
                    }
                }

                setStocks(portfolioFiltered)
                setPastInvestedStocks(pastInvested)
            }
        }
        fetchStocks()
    }, [user, selectedSector, loadPastInvested, supabase])

    /* ─── Company Name Autocomplete ─── */
    const searchCompanies = async (query: string) => {
        if (!query || query.length < 2) { setCompanySuggestions([]); setShowSuggestions(false); return }
        const { data } = await supabase
            .from('stocks')
            .select('id, company_name')
            .ilike('company_name', `%${query}%`)
            .limit(10)
        if (data && data.length > 0) {
            setCompanySuggestions(data)
            setShowSuggestions(true)
        } else {
            setCompanySuggestions([])
            setShowSuggestions(false)
        }
    }

    /* ─── Helper: Update transaction_records ─── */
    const updateTransactionRecords = async (stockId: string) => {
        if (!user) return
        // Count total transactions for this stock
        const { count } = await supabase
            .from('journal_ledger_history')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('stock_id', stockId)

        const totalRecords = count || 1

        await supabase.from('transaction_records').upsert({
            user_id: user.id,
            stock_id: stockId,
            is_invested_previous: true,
            no_trans_records: totalRecords,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,stock_id' })
    }

    /* ─── Handle Buy Shares ─── */
    const handleBuyShares = async () => {
        if (!buyStock || !user) return
        if (txPrice <= 0 || txShares <= 0) { alert('Please enter valid price and shares.'); return }

        setTxLoading(true)
        try {
            const oldBaseline = buyStock.baseline_price
            const oldShares = buyStock.shares_count
            const newShares = oldShares + txShares
            const newBaseline = (oldBaseline * oldShares + txPrice * txShares) / newShares

            // Update user_alerts
            await supabase.from('user_alerts').update({
                baseline_price: parseFloat(newBaseline.toFixed(2)),
                shares_count: newShares,
                updated_at: new Date().toISOString()
            }).eq('id', buyStock.alert_id).eq('user_id', user.id)

            // Record transaction
            await supabase.from('journal_ledger_history').insert({
                user_id: user.id,
                stock_id: buyStock.stock_id,
                transaction_type: 'buy',
                transaction_price: txPrice,
                num_shares: txShares,
                previous_baseline_price: oldBaseline,
                updated_baseline_price: parseFloat(newBaseline.toFixed(2)),
                previous_shares_count: oldShares,
                updated_shares_count: newShares,
                profit_loss: 0,
                profit_loss_per_share: 0,
            })

            // Update transaction_records
            await updateTransactionRecords(buyStock.stock_id)

            setBuyStock(null)
            setTxPrice(0)
            setTxShares(0)
            // Refresh
            setSelectedSector(prev => { const v = prev; setSelectedSector(''); setTimeout(() => setSelectedSector(v), 50); return prev })
        } catch (error) {
            console.error('Buy error:', error)
            alert('Failed to record purchase.')
        } finally {
            setTxLoading(false)
        }
    }

    /* ─── Handle Sell Shares ─── */
    const handleSellShares = async () => {
        if (!sellStock || !user) return
        if (txPrice <= 0 || txShares <= 0) { alert('Please enter valid price and shares.'); return }
        if (txShares > sellStock.shares_count) { alert('Cannot sell more shares than you own.'); return }

        setTxLoading(true)
        try {
            const oldBaseline = sellStock.baseline_price
            const oldShares = sellStock.shares_count
            const newShares = oldShares - txShares
            const profitPerShare = txPrice - oldBaseline
            const totalProfitLoss = profitPerShare * txShares

            // Update user_alerts (baseline stays the same)
            // If newShares === 0, auto-convert to not-portfolio
            const updateData: any = {
                shares_count: newShares,
                updated_at: new Date().toISOString()
            }
            if (newShares === 0) {
                updateData.is_portfolio = false
            }
            await supabase.from('user_alerts').update(updateData)
                .eq('id', sellStock.alert_id).eq('user_id', user.id)

            // Record transaction
            await supabase.from('journal_ledger_history').insert({
                user_id: user.id,
                stock_id: sellStock.stock_id,
                transaction_type: 'sell',
                transaction_price: txPrice,
                num_shares: txShares,
                previous_baseline_price: oldBaseline,
                updated_baseline_price: oldBaseline,
                previous_shares_count: oldShares,
                updated_shares_count: newShares,
                profit_loss: parseFloat(totalProfitLoss.toFixed(2)),
                profit_loss_per_share: parseFloat(profitPerShare.toFixed(2)),
            })

            // Update transaction_records
            await updateTransactionRecords(sellStock.stock_id)

            setSellStock(null)
            setTxPrice(0)
            setTxShares(0)
            setSelectedSector(prev => { const v = prev; setSelectedSector(''); setTimeout(() => setSelectedSector(v), 50); return prev })
        } catch (error) {
            console.error('Sell error:', error)
            alert('Failed to record sale.')
        } finally {
            setTxLoading(false)
        }
    }

    /* ─── Handle Convert to Portfolio (for past-invested stocks) ─── */
    const handleConvertToPortfolio = async () => {
        if (!convertStock || !user) return
        setTxLoading(true)
        try {
            await supabase.from('user_alerts').update({
                is_portfolio: true,
                updated_at: new Date().toISOString()
            }).eq('id', convertStock.alert_id).eq('user_id', user.id)

            // Now open the buy modal with this stock as portfolio
            const updatedStock = { ...convertStock, is_portfolio: true }
            setConvertStock(null)
            setBuyStock(updatedStock)
            setTxPrice(0)
            setTxShares(0)
            // Refresh stocks
            setSelectedSector(prev => { const v = prev; setSelectedSector(''); setTimeout(() => setSelectedSector(v), 50); return prev })
        } catch (error) {
            console.error('Convert error:', error)
            alert('Failed to convert to portfolio.')
        } finally {
            setTxLoading(false)
        }
    }

    /* ─── Fetch Profit/Loss Booked ─── */
    const fetchProfitLoss = async () => {
        if (!user) return
        try {
            const { data } = await supabase
                .from('journal_ledger_history')
                .select('profit_loss, stocks(company_name)')
                .eq('user_id', user.id)
                .eq('transaction_type', 'sell')

            if (data) {
                const profitMap = new Map<string, number>()
                const lossMap = new Map<string, number>()
                let totalProfit = 0
                let totalLoss = 0

                data.forEach((t: any) => {
                    const name = t.stocks?.company_name || 'Unknown'
                    const pl = t.profit_loss || 0
                    if (pl > 0) {
                        totalProfit += pl
                        profitMap.set(name, (profitMap.get(name) || 0) + pl)
                    } else if (pl < 0) {
                        totalLoss += Math.abs(pl)
                        lossMap.set(name, (lossMap.get(name) || 0) + Math.abs(pl))
                    }
                })

                setProfitBooked(totalProfit)
                setLossBooked(totalLoss)
                setProfitDetails(Array.from(profitMap.entries()).map(([company_name, amount]) => ({ company_name, amount })))
                setLossDetails(Array.from(lossMap.entries()).map(([company_name, amount]) => ({ company_name, amount })))
            }
        } catch (error) {
            console.error('Error fetching profit/loss:', error)
        }
    }

    useEffect(() => {
        if (user) fetchProfitLoss()
    }, [user, supabase])

    /* ─── Track Transactions ─── */
    const fetchTransactions = async (mode: 'overall' | 'single' | 'sector', companyName?: string, sectorId?: string) => {
        if (!user) return
        setTxFetching(true)
        try {
            let query = supabase
                .from('journal_ledger_history')
                .select('*, stocks(company_name, sector:sectors(id, name))')
                .eq('user_id', user.id)
                .order('created_at', { ascending: true })

            if (mode === 'overall' && !loadPastInvested) {
                // When LoadPast-Invested is OFF, only show portfolio company transactions
                const { data: portfolioAlerts } = await supabase
                    .from('user_alerts')
                    .select('stock_id')
                    .eq('user_id', user.id)
                    .eq('is_portfolio', true)
                if (portfolioAlerts && portfolioAlerts.length > 0) {
                    query = query.in('stock_id', portfolioAlerts.map((a: any) => a.stock_id))
                } else {
                    setTransactions([])
                    setShowTransactions(true)
                    setTxFetching(false)
                    return
                }
            } else if (mode === 'single' && companyName) {
                const { data: stockData } = await supabase.from('stocks').select('id').eq('company_name', companyName).single()
                if (stockData) {
                    query = query.eq('stock_id', stockData.id)
                }
            } else if (mode === 'sector' && sectorId) {
                const { data: sectorStocks } = await supabase.from('stocks').select('id').eq('sector_id', sectorId)
                if (sectorStocks && sectorStocks.length > 0) {
                    query = query.in('stock_id', sectorStocks.map((s: any) => s.id))
                }
            }

            const { data, error } = await query
            if (error) throw error

            const formatted: Transaction[] = (data || []).map((t: any) => ({
                id: t.id,
                stock_id: t.stock_id,
                company_name: t.stocks?.company_name || 'Unknown',
                transaction_type: t.transaction_type,
                transaction_price: t.transaction_price,
                num_shares: t.num_shares,
                previous_baseline_price: t.previous_baseline_price,
                updated_baseline_price: t.updated_baseline_price,
                previous_shares_count: t.previous_shares_count,
                updated_shares_count: t.updated_shares_count,
                profit_loss: t.profit_loss,
                profit_loss_per_share: t.profit_loss_per_share,
                created_at: t.created_at,
            }))

            setTransactions(formatted)
            setShowTransactions(true)
        } catch (error) {
            console.error('Error fetching transactions:', error)
            alert('Failed to fetch transactions.')
        } finally {
            setTxFetching(false)
        }
    }

    const handleTrackSubmit = () => {
        if (trackMode === 'overall') {
            fetchTransactions('overall')
        } else if (trackMode === 'single') {
            if (!trackCompanyName.trim()) { alert('Please enter a company name.'); return }
            fetchTransactions('single', trackCompanyName)
        } else if (trackMode === 'sector') {
            if (!trackSectorId) { alert('Please select a sector.'); return }
            fetchTransactions('sector', undefined, trackSectorId)
        }
        setShowTrackPopup(false)
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/')
    }

    const buyTx = transactions.filter(t => t.transaction_type === 'buy')
    const sellTx = transactions.filter(t => t.transaction_type === 'sell')

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#020817] text-white">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020817] text-white">
            {/* ── Header ── */}
            <header className="sticky top-0 z-40 border-b border-blue-500/10 bg-[#020817]/95 backdrop-blur-xl">
                <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowNavMenu(!showNavMenu)} className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-blue-400 hover:bg-blue-500/10 transition-colors">
                            <Menu className="h-5 w-5" />
                        </button>
                        <Image src="/assets/HooxMainLogo-removebg-preview.png" alt="Hoox Logo" width={100} height={35} className="h-8 w-auto drop-shadow-lg cursor-pointer" onClick={() => router.push('/dashboard')} priority />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setShowTrackPopup(true); setTrackMode(null) }}
                            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
                        >
                            <History className="h-4 w-4" />
                            Track-Transactions
                        </button>
                        <button onClick={() => setShowNavMenu(true)} className="rounded-full border border-red-500/20 bg-red-500/5 p-2 text-red-400 hover:bg-red-500/10 transition-colors md:hidden" title="Menu">
                            <Menu className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Slide-out Navigation ── */}
            {showNavMenu && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={() => setShowNavMenu(false)}>
                    <div className="absolute left-0 top-0 h-full w-72 border-r border-blue-500/10 bg-[#020817] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="mb-8 flex items-center justify-between">
                            <Image src="/assets/HooxMainLogo-removebg-preview.png" alt="Hoox" width={100} height={35} className="h-8 w-auto" />
                            <button onClick={() => setShowNavMenu(false)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
                        </div>
                        <nav className="space-y-2">
                            <button onClick={() => { router.push('/dashboard'); setShowNavMenu(false) }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-gray-400 hover:bg-blue-500/5 hover:text-blue-400 transition-colors">
                                <LayoutDashboard className="h-5 w-5" /> Stock Watchlist
                            </button>
                            <button onClick={() => setShowNavMenu(false)} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-gray-400 hover:bg-blue-500/5 hover:text-blue-400 transition-colors">
                                <Bell className="h-5 w-5" /> Alert History
                            </button>
                            <button onClick={() => { router.push('/prctrendtracker'); setShowNavMenu(false) }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-gray-400 hover:bg-blue-500/5 hover:text-blue-400 transition-colors">
                                <BarChart3 className="h-5 w-5" /> PrcTrendTracker
                            </button>
                            <button onClick={() => setShowNavMenu(false)} className="flex w-full items-center gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-blue-400 font-medium">
                                <BookOpen className="h-5 w-5" /> Journal & Ledger
                            </button>
                        </nav>
                        <div className="my-6 border-t border-blue-500/10" />
                        <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors">
                            <LogOut className="h-5 w-5" /> Sign Out
                        </button>
                    </div>
                </div>
            )}

            {/* ── Main Content ── */}
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
                {/* Title + Profit/Loss Booked + LoadPast-Invested + Dropdown */}
                <div className="mb-6 flex flex-col gap-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-xl font-bold lg:text-2xl text-white flex items-center gap-2">
                                <BookOpen className="h-6 w-6 text-blue-400" />
                                Journal & Ledger
                            </h1>
                            <p className="text-sm text-gray-500">Track your buy/sell transactions and portfolio changes.</p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* LoadPast-Invested Checkbox */}
                            <button
                                onClick={() => setLoadPastInvested(!loadPastInvested)}
                                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${loadPastInvested
                                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                                    : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                {loadPastInvested ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                LoadPast-Invested
                            </button>

                            {/* Sector/Filter Dropdown */}
                            <div className="relative">
                                <select
                                    value={selectedSector}
                                    onChange={(e) => setSelectedSector(e.target.value)}
                                    className="appearance-none rounded-xl border border-white/10 bg-white/5 pl-4 pr-10 py-2.5 text-sm font-medium text-white backdrop-blur-md cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    style={{ colorScheme: 'dark' }}
                                >
                                    <option value="" className="bg-black">Select a Filter</option>
                                    <option value="portfolio_stocks" className="bg-black">💼 Portfolio Stocks</option>
                                    <option value="invested_sold" className="bg-black">📉 Invested-sold-companies</option>
                                    <option value="interested_not_portfolio" className="bg-black">⭐ Interested-NotPortfolio</option>
                                    <option value="" disabled className="bg-black">──────────────</option>
                                    {sectors.map((s) => (
                                        <option key={s.id} value={s.id} className="bg-black">🏢 {s.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    {/* Profit Booked / Loss Booked Stats */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowProfitPopup(true)}
                            className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-2.5 text-sm font-medium text-green-400 hover:bg-green-500/10 transition-colors cursor-pointer"
                        >
                            <TrendingUp className="h-4 w-4" />
                            Profit Booked: <span className="font-bold">₹{profitBooked.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </button>
                        <button
                            onClick={() => setShowLossPopup(true)}
                            className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                            <TrendingDown className="h-4 w-4" />
                            Loss Booked: <span className="font-bold">₹{lossBooked.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </button>
                    </div>
                </div>

                {/* Stock Cards */}
                {!selectedSector ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-20 text-center">
                        <div className="mb-4 rounded-full bg-white/5 p-4">
                            <BookOpen className="h-10 w-10 text-gray-500" />
                        </div>
                        <h3 className="text-lg font-medium text-white">Select a Filter</h3>
                        <p className="mt-1 text-sm text-gray-400">Choose a filter or sector from the dropdown to view your companies.</p>
                    </div>
                ) : stocks.length === 0 && pastInvestedStocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-20 text-center">
                        <div className="mb-4 rounded-full bg-white/5 p-4">
                            <AlertTriangle className="h-10 w-10 text-gray-500" />
                        </div>
                        <h3 className="text-lg font-medium text-white">No Companies Found</h3>
                        <p className="mt-1 text-sm text-gray-400">No companies match the selected filter.</p>
                    </div>
                ) : (
                    <div className={`grid gap-6 ${pastInvestedStocks.length > 0 ? 'lg:grid-cols-2' : ''}`}>
                        {/* Left side: Portfolio Company Cards */}
                        {stocks.length > 0 && (
                            <div>
                                <h2 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                                    💼 Portfolio Companies ({stocks.length})
                                </h2>
                                <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-2">
                                    {stocks.map((stock) => (
                                        <div key={stock.alert_id} className="relative overflow-hidden rounded-xl border border-blue-500/20 bg-white/5 p-5 backdrop-blur-lg transition-all hover:border-blue-500/30 hover:bg-white/10">
                                            <div className="mb-3">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="text-base font-semibold text-white">{stock.company_name}</h3>
                                                    {stock.is_portfolio && (
                                                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">Portfolio</span>
                                                    )}
                                                </div>
                                                {stock.sector_name && <p className="text-xs text-gray-500">Sector: {stock.sector_name}</p>}
                                            </div>
                                            <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-3 mb-4">
                                                <div>
                                                    <p className="text-xs text-gray-500">Baseline</p>
                                                    <p className="text-sm font-bold text-white">₹{stock.baseline_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Shares</p>
                                                    <p className="text-sm font-bold text-white">{stock.shares_count}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Invested</p>
                                                    <p className="text-sm font-bold text-white">₹{(stock.baseline_price * stock.shares_count).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 border-t border-white/5 pt-3">
                                                <button
                                                    onClick={() => { setBuyStock(stock); setTxPrice(0); setTxShares(0) }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-600/15 px-3 py-2 text-xs font-semibold text-green-400 hover:bg-green-600/25 transition-colors"
                                                >
                                                    <ShoppingCart className="h-3.5 w-3.5" />
                                                    Bought
                                                </button>
                                                <button
                                                    onClick={() => { setSellStock(stock); setTxPrice(0); setTxShares(0) }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600/15 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-600/25 transition-colors"
                                                >
                                                    <DollarSign className="h-3.5 w-3.5" />
                                                    Sold
                                                </button>
                                                <button
                                                    onClick={() => fetchTransactions('single', stock.company_name)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600/15 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-600/25 transition-colors"
                                                >
                                                    <History className="h-3.5 w-3.5" />
                                                    Track History
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Right side: Past-Invested Company Cards (Yellow) */}
                        {pastInvestedStocks.length > 0 && (
                            <div>
                                <h2 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                                    📉 Past-Invested Companies ({pastInvestedStocks.length})
                                </h2>
                                <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-2">
                                    {pastInvestedStocks.map((stock) => (
                                        <div key={stock.alert_id} className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 backdrop-blur-lg transition-all hover:border-amber-500/40 hover:bg-amber-500/10">
                                            <div className="mb-3">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="text-base font-semibold text-amber-100">{stock.company_name}</h3>
                                                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">Past-Invested</span>
                                                </div>
                                                {stock.sector_name && <p className="text-xs text-amber-600/70">Sector: {stock.sector_name}</p>}
                                                <p className="text-xs text-amber-500/70 mt-0.5">Transactions: {stock.no_trans_records || 0}</p>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3 border-t border-amber-500/10 pt-3 mb-4">
                                                <div>
                                                    <p className="text-xs text-amber-600/70">Last Baseline</p>
                                                    <p className="text-sm font-bold text-amber-100">₹{stock.baseline_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-amber-600/70">Shares</p>
                                                    <p className="text-sm font-bold text-amber-100">{stock.shares_count}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-amber-600/70">Status</p>
                                                    <p className="text-sm font-bold text-amber-400">Sold</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 border-t border-amber-500/10 pt-3">
                                                <button
                                                    onClick={() => setConvertStock(stock)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/25 transition-colors"
                                                >
                                                    <ShoppingCart className="h-3.5 w-3.5" />
                                                    Bought Shares
                                                </button>
                                                <button
                                                    onClick={() => fetchTransactions('single', stock.company_name)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600/15 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-600/25 transition-colors"
                                                >
                                                    <History className="h-3.5 w-3.5" />
                                                    Track History
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Transaction History Display ── */}
                {showTransactions && (
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <History className="h-5 w-5 text-amber-400" />
                                Transaction History
                            </h2>
                            <button onClick={() => setShowTransactions(false)} className="text-gray-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {transactions.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-white/10 py-12 text-center">
                                <p className="text-gray-400">No transactions found.</p>
                            </div>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-2">
                                {/* Bought Records */}
                                <div>
                                    <h3 className="text-sm font-bold text-green-400 mb-3 flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4" /> Bought Shares Records ({buyTx.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {buyTx.length === 0 ? (
                                            <p className="text-xs text-gray-500 text-center py-4">No buy records.</p>
                                        ) : buyTx.map((tx) => (
                                            <div key={tx.id} className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="text-sm font-semibold text-white">{tx.company_name}</h4>
                                                    <span className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString('en-IN')}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-gray-400">Buy Price: </span>
                                                        <span className="text-white font-medium">₹{tx.transaction_price.toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">Shares: </span>
                                                        <span className="text-white font-medium">{tx.num_shares}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">Prev Baseline: </span>
                                                        <span className="text-gray-300">₹{tx.previous_baseline_price.toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">New Baseline: </span>
                                                        <span className="text-green-400 font-medium">₹{tx.updated_baseline_price.toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">Prev Shares: </span>
                                                        <span className="text-gray-300">{tx.previous_shares_count}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">New Shares: </span>
                                                        <span className="text-green-400 font-medium">{tx.updated_shares_count}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Sold Records */}
                                <div>
                                    <h3 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                                        <DollarSign className="h-4 w-4" /> Sold Shares Records ({sellTx.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {sellTx.length === 0 ? (
                                            <p className="text-xs text-gray-500 text-center py-4">No sell records.</p>
                                        ) : sellTx.map((tx) => (
                                            <div key={tx.id} className={`rounded-xl border p-4 ${tx.profit_loss >= 0 ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="text-sm font-semibold text-white">{tx.company_name}</h4>
                                                    <span className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString('en-IN')}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-gray-400">Sell Price: </span>
                                                        <span className="text-white font-medium">₹{tx.transaction_price.toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">Shares Sold: </span>
                                                        <span className="text-white font-medium">{tx.num_shares}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">Baseline: </span>
                                                        <span className="text-gray-300">₹{tx.previous_baseline_price.toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">Remaining: </span>
                                                        <span className="text-white font-medium">{tx.updated_shares_count} shares</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">P/L per share: </span>
                                                        <span className={`font-medium ${tx.profit_loss_per_share >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {tx.profit_loss_per_share >= 0 ? '+' : ''}₹{tx.profit_loss_per_share.toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">Total P/L: </span>
                                                        <span className={`font-bold ${tx.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {tx.profit_loss >= 0 ? '+' : ''}₹{tx.profit_loss.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ── Buy Shares Modal ── */}
            {buyStock && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setBuyStock(null)}>
                    <div className="w-full max-w-md rounded-2xl border border-green-500/30 bg-[#0a0a0f] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/15">
                                <ShoppingCart className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Buy Shares</h3>
                                <p className="text-xs text-gray-400">{buyStock.company_name}</p>
                            </div>
                        </div>

                        <div className="space-y-3 mb-3">
                            <div className="rounded-lg bg-white/5 p-3 text-xs text-gray-400">
                                Current: <span className="text-white font-medium">₹{buyStock.baseline_price.toLocaleString()}</span> × <span className="text-white font-medium">{buyStock.shares_count}</span> shares
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-300 mb-1 block">Bought Price (₹)</label>
                                <input type="number" step="0.01" value={txPrice || ''} onChange={e => setTxPrice(parseFloat(e.target.value) || 0)} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-green-500 focus:outline-none" placeholder="Enter bought price" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-300 mb-1 block">No. of Shares</label>
                                <input type="number" min="1" value={txShares || ''} onChange={e => setTxShares(parseInt(e.target.value) || 0)} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-green-500 focus:outline-none" placeholder="Enter number of shares" />
                            </div>
                            {txPrice > 0 && txShares > 0 && (
                                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-xs">
                                    <p className="text-gray-400">New Baseline: <span className="text-green-400 font-bold">₹{((buyStock.baseline_price * buyStock.shares_count + txPrice * txShares) / (buyStock.shares_count + txShares)).toFixed(2)}</span></p>
                                    <p className="text-gray-400">New Shares: <span className="text-green-400 font-bold">{buyStock.shares_count + txShares}</span></p>
                                    <p className="text-gray-400">Total Invested: <span className="text-white font-bold">₹{(buyStock.baseline_price * buyStock.shares_count + txPrice * txShares).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setBuyStock(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">Cancel</button>
                            <button onClick={handleBuyShares} disabled={txLoading} className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                {txLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                Confirm Buy
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Sell Shares Modal ── */}
            {sellStock && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSellStock(null)}>
                    <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#0a0a0f] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
                                <DollarSign className="h-5 w-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Sell Shares</h3>
                                <p className="text-xs text-gray-400">{sellStock.company_name}</p>
                            </div>
                        </div>

                        <div className="space-y-3 mb-3">
                            <div className="rounded-lg bg-white/5 p-3 text-xs text-gray-400">
                                Current: <span className="text-white font-medium">₹{sellStock.baseline_price.toLocaleString()}</span> × <span className="text-white font-medium">{sellStock.shares_count}</span> shares
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-300 mb-1 block">Sold Price (₹)</label>
                                <input type="number" step="0.01" value={txPrice || ''} onChange={e => setTxPrice(parseFloat(e.target.value) || 0)} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-red-500 focus:outline-none" placeholder="Enter sold price" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-300 mb-1 block">No. of Shares Sold</label>
                                <input type="number" min="1" max={sellStock.shares_count} value={txShares || ''} onChange={e => setTxShares(parseInt(e.target.value) || 0)} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-red-500 focus:outline-none" placeholder={`Max: ${sellStock.shares_count}`} />
                            </div>
                            {txPrice > 0 && txShares > 0 && txShares <= sellStock.shares_count && (
                                <div className={`rounded-lg border p-3 text-xs ${(txPrice - sellStock.baseline_price) >= 0 ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                                    <p className="text-gray-400">Baseline stays: <span className="text-white font-bold">₹{sellStock.baseline_price.toLocaleString()}</span></p>
                                    <p className="text-gray-400">Remaining Shares: <span className="text-white font-bold">{sellStock.shares_count - txShares}</span></p>
                                    <p className="text-gray-400">P/L per share: <span className={`font-bold ${(txPrice - sellStock.baseline_price) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(txPrice - sellStock.baseline_price) >= 0 ? '+' : ''}₹{(txPrice - sellStock.baseline_price).toFixed(2)}</span></p>
                                    <p className="text-gray-400">Total P/L: <span className={`font-bold ${(txPrice - sellStock.baseline_price) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{((txPrice - sellStock.baseline_price) * txShares) >= 0 ? '+' : ''}₹{((txPrice - sellStock.baseline_price) * txShares).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setSellStock(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">Cancel</button>
                            <button onClick={handleSellShares} disabled={txLoading} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                {txLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                Confirm Sell
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Track Transactions Popup ── */}
            {showTrackPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowTrackPopup(false)}>
                    <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#0a0a0f] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
                                <History className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Track Transactions</h3>
                                <p className="text-xs text-gray-400">Choose how to view your transaction history</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4">
                            {(['overall', 'single', 'sector'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setTrackMode(mode)}
                                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${trackMode === mode ? 'border-amber-500/40 bg-amber-500/10 text-amber-400' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                                >
                                    <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${trackMode === mode ? 'border-amber-400' : 'border-gray-500'}`}>
                                        {trackMode === mode && <div className="h-2 w-2 rounded-full bg-amber-400" />}
                                    </div>
                                    <span className="text-sm font-medium">
                                        {mode === 'overall' ? 'Track Overall History' : mode === 'single' ? 'Single Company History' : 'Sector-selected History'}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Additional inputs based on mode */}
                        {trackMode === 'single' && (
                            <div className="mb-4 relative">
                                <label className="text-sm font-medium text-gray-300 mb-1 block">Company Name</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={trackCompanyName}
                                        onChange={e => {
                                            setTrackCompanyName(e.target.value)
                                            searchCompanies(e.target.value)
                                        }}
                                        onFocus={() => { if (companySuggestions.length > 0) setShowSuggestions(true) }}
                                        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                                        placeholder="Type company name to search..."
                                    />
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                </div>
                                {showSuggestions && companySuggestions.length > 0 && (
                                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-[#0d0d0d] shadow-xl">
                                        {companySuggestions.map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => {
                                                    setTrackCompanyName(s.company_name)
                                                    setShowSuggestions(false)
                                                    setCompanySuggestions([])
                                                }}
                                                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-gray-300 hover:bg-amber-500/10 hover:text-amber-400 transition-colors border-b border-white/5 last:border-0"
                                            >
                                                <Search className="h-3 w-3 text-gray-500" />
                                                {s.company_name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {trackMode === 'sector' && (
                            <div className="mb-4">
                                <label className="text-sm font-medium text-gray-300 mb-1 block">Select Sector</label>
                                <select value={trackSectorId} onChange={e => setTrackSectorId(e.target.value)} className="w-full rounded-md border border-white/10 bg-black px-3 py-2 text-white focus:border-amber-500 focus:outline-none" style={{ colorScheme: 'dark' }}>
                                    <option value="">Choose sector</option>
                                    {sectors.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                                </select>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setShowTrackPopup(false)} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">Cancel</button>
                            <button onClick={handleTrackSubmit} disabled={!trackMode || txFetching} className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                {txFetching && <Loader2 className="h-4 w-4 animate-spin" />}
                                Load History
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Convert to Portfolio Modal ── */}
            {convertStock && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setConvertStock(null)}>
                    <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#0a0a0f] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
                                <AlertTriangle className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Convert to Portfolio</h3>
                                <p className="text-xs text-gray-400">{convertStock.company_name}</p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 mb-4">
                            <p className="text-sm text-amber-200">
                                First convert <span className="font-bold text-amber-400">{convertStock.company_name}</span> to type Portfolio and then adjust transaction.
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                                <input type="radio" name="convertPortfolio" defaultChecked className="h-4 w-4 text-amber-500" />
                                <span className="text-sm font-medium text-amber-400">Convert to Portfolio</span>
                            </label>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setConvertStock(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">Cancel</button>
                            <button onClick={handleConvertToPortfolio} disabled={txLoading} className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                {txLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                Convert & Buy
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Profit Booked Popup ── */}
            {showProfitPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowProfitPopup(false)}>
                    <div className="w-full max-w-md rounded-2xl border border-green-500/30 bg-[#0a0a0f] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/15">
                                <TrendingUp className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Profit Booked</h3>
                                <p className="text-xs text-gray-400">Total: ₹{profitBooked.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                            </div>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {profitDetails.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">No profit transactions yet.</p>
                            ) : profitDetails.map((d, i) => (
                                <div key={i} className="flex items-center justify-between rounded-lg border border-green-500/10 bg-green-500/5 px-4 py-3">
                                    <span className="text-sm text-white font-medium">{d.company_name}</span>
                                    <span className="text-sm font-bold text-green-400">+₹{d.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setShowProfitPopup(false)} className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">Close</button>
                    </div>
                </div>
            )}

            {/* ── Loss Booked Popup ── */}
            {showLossPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowLossPopup(false)}>
                    <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#0a0a0f] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
                                <TrendingDown className="h-5 w-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Loss Booked</h3>
                                <p className="text-xs text-gray-400">Total: ₹{lossBooked.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                            </div>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {lossDetails.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">No loss transactions yet.</p>
                            ) : lossDetails.map((d, i) => (
                                <div key={i} className="flex items-center justify-between rounded-lg border border-red-500/10 bg-red-500/5 px-4 py-3">
                                    <span className="text-sm text-white font-medium">{d.company_name}</span>
                                    <span className="text-sm font-bold text-red-400">-₹{d.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setShowLossPopup(false)} className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">Close</button>
                    </div>
                </div>
            )}

            {/* Loading overlay */}
            {txFetching && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#0d0d0d] px-8 py-6 shadow-2xl">
                        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                        <p className="text-sm font-medium text-white">Loading transactions...</p>
                    </div>
                </div>
            )}
        </div>
    )
}
