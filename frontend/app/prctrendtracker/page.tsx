'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
    Search, TrendingUp, TrendingDown, ArrowLeft, BarChart3,
    Loader2, X, ChevronDown, Briefcase, Building2, Filter,
    Menu, LayoutDashboard, Bell, LogOut, BookOpen, AlertTriangle
} from 'lucide-react'
import Image from 'next/image'

/* ─────────────────── Types ─────────────────── */
interface MonthTrend {
    month: string       // e.g. "Mar 2025"
    monthNum: number
    year: number
    firstPrice: number
    lastPrice: number
    trendPercent: number
}

interface ThreeYearMonthGroup {
    monthName: string   // e.g. "March"
    monthNum: number
    years: { year: number; trendPercent: number | null }[]
}

interface CompanySearchResult {
    name: string
    url: string           // e.g. "/company/TCS/consolidated/"
    slug: string          // e.g. "TCS"
}

interface StockFromDB {
    id: string
    company_name: string
    symbol: string
    sector_name?: string
    sector_id?: string
    is_portfolio?: boolean
    shares_count?: number
    baseline_price?: number
    interest?: 'interested' | 'not-interested'
    stock_id?: string
}

/* ─────────────────── Helpers ─────────────────── */
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function extractSlugFromUrl(url: string): string {
    // "/company/TCS/consolidated/" → "TCS"
    const parts = url.replace(/^\/|\/$/g, '').split('/')
    // parts: ["company", "TCS", "consolidated"] or ["company", "TCS"]
    return parts[1] || ''
}

function parseChartData(datasets: any[]): { date: string; price: number }[] {
    // The screener chart API returns an object with datasets array
    // datasets[0] is the Price data: { values: [[dateStr, priceVal], ...] }
    if (!datasets || !datasets[0] || !datasets[0].values) return []

    return datasets[0].values
        .map((entry: [string, any]) => ({
            date: entry[0],
            price: Number(entry[1]),
        }))
        .filter((item: { date: string; price: number }) => !isNaN(item.price) && item.price > 0)
}

function calculateMonthlyTrends(priceData: { date: string; price: number }[]): MonthTrend[] {
    if (!priceData.length) return []

    // Group by month-year
    const monthGroups: Record<string, { date: string; price: number }[]> = {}

    priceData.forEach(({ date, price }) => {
        const d = new Date(date)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        if (!monthGroups[key]) monthGroups[key] = []
        monthGroups[key].push({ date, price })
    })

    const trends: MonthTrend[] = []

    Object.entries(monthGroups).forEach(([key, entries]) => {
        if (entries.length < 2) return

        // Sort by date
        entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        const firstPrice = Number(entries[0].price)
        const lastPrice = Number(entries[entries.length - 1].price)

        // Skip if prices are not valid numbers
        if (isNaN(firstPrice) || isNaN(lastPrice) || firstPrice <= 0) return

        const trendPercent = ((lastPrice - firstPrice) / firstPrice) * 100

        const [yearStr, monthStr] = key.split('-')
        const year = parseInt(yearStr)
        const monthNum = parseInt(monthStr)

        trends.push({
            month: `${MONTH_NAMES[monthNum]} ${year}`,
            monthNum,
            year,
            firstPrice,
            lastPrice,
            trendPercent: isNaN(trendPercent) ? 0 : trendPercent,
        })
    })

    // Sort by date
    trends.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.monthNum - b.monthNum
    })

    return trends
}

function calculateThreeYearGrouped(priceData: { date: string; price: number }[]): ThreeYearMonthGroup[] {
    const monthlyTrends = calculateMonthlyTrends(priceData)

    // Group by month number across years
    const grouped: Record<number, { year: number; trendPercent: number }[]> = {}

    monthlyTrends.forEach((t) => {
        if (!grouped[t.monthNum]) grouped[t.monthNum] = []
        grouped[t.monthNum].push({ year: t.year, trendPercent: t.trendPercent })
    })

    const result: ThreeYearMonthGroup[] = []

    // Get all unique years
    const allYears = [...new Set(monthlyTrends.map(t => t.year))].sort()

    for (let m = 0; m < 12; m++) {
        const monthEntries = grouped[m] || []

        result.push({
            monthName: MONTH_FULL[m],
            monthNum: m,
            years: allYears.map(y => {
                const entry = monthEntries.find(e => e.year === y)
                return { year: y, trendPercent: entry ? entry.trendPercent : null }
            })
        })
    }

    return result
}

/* ─────────────────── Main Page ─────────────────── */
export default function PrcTrendTracker() {
    const router = useRouter()
    const supabase = createClient()

    // Auth
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    // DB Data
    const [dbStocks, setDbStocks] = useState<StockFromDB[]>([])
    const [sectors, setSectors] = useState<{ id: string; name: string }[]>([])

    // Dropdown filter
    const [viewFilter, setViewFilter] = useState<string>('portfolio') // 'portfolio', 'non-portfolio', or sector id

    // Search
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([])
    const [searching, setSearching] = useState(false)
    const [selectedCompany, setSelectedCompany] = useState<{
        name: string
        slug: string
        isPortfolio: boolean
        isInDB: boolean
    } | null>(null)

    // Trend data
    const [trendLoading, setTrendLoading] = useState(false)
    const [trendType, setTrendType] = useState<'1Y' | '3Y' | null>(null)
    const [monthlyTrends, setMonthlyTrends] = useState<MonthTrend[]>([])
    const [threeYearTrends, setThreeYearTrends] = useState<ThreeYearMonthGroup[]>([])
    const [showTrendModal, setShowTrendModal] = useState(false)
    const [trendCompanyName, setTrendCompanyName] = useState('')

    // Portfolio analytics for selected view
    const [viewStocks, setViewStocks] = useState<StockFromDB[]>([])
    const [fetchingPrices, setFetchingPrices] = useState(false)
    const [livePrices, setLivePrices] = useState<Record<string, number>>({})

    // Navigation
    const [showNavMenu, setShowNavMenu] = useState(false)

    // Interest change
    const [interestConfirmStock, setInterestConfirmStock] = useState<StockFromDB | null>(null)

    /* ─── Auth ─── */
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/')
                return
            }
            setUser(user)
            setLoading(false)
        }
        getUser()
    }, [supabase, router])

    /* ─── Fetch DB stocks & sectors ─── */
    useEffect(() => {
        if (!user) return

        const fetchData = async () => {
            // Fetch user's alerts with stock + sector info
            const { data: alertData } = await supabase
                .from('user_alerts')
                .select(`
                    id,
                    baseline_price,
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
                .eq('user_id', user.id)

            if (alertData) {
                const formatted: StockFromDB[] = alertData.map((a: any) => ({
                    id: a.id,
                    company_name: a.stock.company_name,
                    symbol: a.stock.symbol || 'NSE',
                    sector_name: a.stock.sector?.name,
                    sector_id: a.stock.sector?.id,
                    is_portfolio: a.is_portfolio,
                    shares_count: a.shares_count,
                    baseline_price: a.baseline_price,
                    interest: a.stock.interest || 'not-interested',
                    stock_id: a.stock.id,
                }))
                setDbStocks(formatted)
            }

            // Fetch sectors
            const { data: sectorData } = await supabase
                .from('sectors')
                .select('id, name')
                .order('name', { ascending: true })

            if (sectorData) setSectors(sectorData)
        }

        fetchData()
    }, [user, supabase])

    /* ─── Filter stocks based on dropdown ─── */
    useEffect(() => {
        if (viewFilter === 'portfolio') {
            setViewStocks(dbStocks.filter(s => s.is_portfolio))
        } else if (viewFilter === 'non-portfolio') {
            setViewStocks(dbStocks.filter(s => !s.is_portfolio))
        } else {
            // Sector filter
            setViewStocks(dbStocks.filter(s => s.sector_id === viewFilter))
        }
    }, [viewFilter, dbStocks])

    /* ─── Search screener.in ─── */
    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return
        setSearching(true)
        setSelectedCompany(null)
        setSearchResults([])

        try {
            const res = await fetch(`/api/screener?action=search&q=${encodeURIComponent(searchQuery)}`)
            const data = await res.json()

            if (Array.isArray(data)) {
                const results: CompanySearchResult[] = data.map((item: any) => ({
                    name: item.name || item.text || '',
                    url: item.url || '',
                    slug: extractSlugFromUrl(item.url || ''),
                }))
                setSearchResults(results)
            }
        } catch (error) {
            console.error('Search error:', error)
        } finally {
            setSearching(false)
        }
    }, [searchQuery])

    /* ─── Select company from search results ─── */
    const handleSelectCompany = (result: CompanySearchResult) => {
        const dbMatch = dbStocks.find(
            s => s.company_name.toLowerCase() === result.name.toLowerCase()
        )

        setSelectedCompany({
            name: result.name,
            slug: result.slug,
            isPortfolio: dbMatch?.is_portfolio || false,
            isInDB: !!dbMatch,
        })
        setSearchResults([])
        setSearchQuery(result.name)
    }

    /* ─── Fetch trend data ─── */
    const fetchTrend = async (type: '1Y' | '3Y') => {
        if (!selectedCompany) return

        setTrendLoading(true)
        setTrendType(type)
        setTrendCompanyName(selectedCompany.name)

        try {
            // Step 1: Get company ID from screener
            const idRes = await fetch(`/api/screener?action=companyId&slug=${encodeURIComponent(selectedCompany.slug)}`)
            const idData = await idRes.json()

            if (!idData.companyId) {
                alert('Could not find company ID on screener.in')
                setTrendLoading(false)
                return
            }

            // Step 2: Fetch chart data
            const days = type === '1Y' ? '365' : '1095'
            const chartRes = await fetch(`/api/screener?action=chart&id=${idData.companyId}&days=${days}`)
            const chartData = await chartRes.json()

            // Step 3: Parse and calculate
            const priceData = parseChartData(chartData.datasets || chartData)

            if (type === '1Y') {
                const trends = calculateMonthlyTrends(priceData)
                setMonthlyTrends(trends)
                setThreeYearTrends([])
            } else {
                const trends = calculateMonthlyTrends(priceData)
                setMonthlyTrends(trends)
                const grouped = calculateThreeYearGrouped(priceData)
                setThreeYearTrends(grouped)
            }

            setShowTrendModal(true)
        } catch (error) {
            console.error('Trend fetch error:', error)
            alert('Failed to fetch trend data')
        } finally {
            setTrendLoading(false)
        }
    }

    /* ─── Fetch trend for a stock from the view list ─── */
    const fetchTrendForStock = async (companyName: string, type: '1Y' | '3Y') => {
        setTrendLoading(true)
        setTrendType(type)
        setTrendCompanyName(companyName)

        try {
            // Search for company on screener
            const searchRes = await fetch(`/api/screener?action=search&q=${encodeURIComponent(companyName)}`)
            const searchData = await searchRes.json()

            if (!Array.isArray(searchData) || searchData.length === 0) {
                alert('Company not found on screener.in')
                setTrendLoading(false)
                return
            }

            const slug = extractSlugFromUrl(searchData[0].url || '')

            // Get company ID
            const idRes = await fetch(`/api/screener?action=companyId&slug=${encodeURIComponent(slug)}`)
            const idData = await idRes.json()

            if (!idData.companyId) {
                alert('Could not find company ID')
                setTrendLoading(false)
                return
            }

            // Fetch chart
            const days = type === '1Y' ? '365' : '1095'
            const chartRes = await fetch(`/api/screener?action=chart&id=${idData.companyId}&days=${days}`)
            const chartData = await chartRes.json()

            const priceData = parseChartData(chartData.datasets || chartData)

            if (type === '1Y') {
                const trends = calculateMonthlyTrends(priceData)
                setMonthlyTrends(trends)
                setThreeYearTrends([])
            } else {
                const trends = calculateMonthlyTrends(priceData)
                setMonthlyTrends(trends)
                const grouped = calculateThreeYearGrouped(priceData)
                setThreeYearTrends(grouped)
            }

            setShowTrendModal(true)
        } catch (error) {
            console.error('Error:', error)
            alert('Failed to fetch trend data')
        } finally {
            setTrendLoading(false)
        }
    }

    /* ─── Fetch live prices for view stocks ─── */
    const fetchLivePrices = async () => {
        if (viewStocks.length === 0) return
        setFetchingPrices(true)
        const prices: Record<string, number> = {}

        for (const stock of viewStocks) {
            try {
                const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')
                const res = await fetch(`${apiBase}/api/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ company_name: stock.company_name }),
                })
                const data = await res.json()
                if (data.success) prices[stock.id] = data.price
            } catch (e) {
                console.error(`Failed price for ${stock.company_name}`)
            }
        }

        setLivePrices(prices)
        setFetchingPrices(false)
    }

    useEffect(() => {
        if (viewStocks.length > 0) fetchLivePrices()
    }, [viewStocks])

    /* ─── Loading state ─── */
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-black text-white">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
        )
    }

    /* ─── Calculate sector totals ─── */
    const isSectorView = viewFilter !== 'portfolio' && viewFilter !== 'non-portfolio'
    const sectorTotals = isSectorView ? (() => {
        let totalInvested = 0
        let totalCurrent = 0

        viewStocks.forEach(s => {
            if (s.is_portfolio && s.shares_count && s.baseline_price) {
                const invested = s.baseline_price * s.shares_count
                totalInvested += invested
                const live = livePrices[s.id]
                totalCurrent += live ? live * s.shares_count : invested
            }
        })

        return {
            totalInvested,
            totalCurrent,
            gain: totalCurrent - totalInvested,
            returnPct: totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0,
        }
    })() : null

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/')
    }

    const handleChangeInterest = async (stock: StockFromDB) => {
        try {
            if (!stock.stock_id) return
            await supabase.from('stocks').update({ interest: 'interested' }).eq('id', stock.stock_id)
            // Refresh data
            const { data: alertData } = await supabase
                .from('user_alerts')
                .select(`id, baseline_price, is_portfolio, shares_count, stock:stocks (id, company_name, symbol, interest, sector:sectors (id, name))`)
                .eq('user_id', user.id)
            if (alertData) {
                const formatted: StockFromDB[] = alertData.map((a: any) => ({
                    id: a.id, company_name: a.stock.company_name, symbol: a.stock.symbol || 'NSE',
                    sector_name: a.stock.sector?.name, sector_id: a.stock.sector?.id,
                    is_portfolio: a.is_portfolio, shares_count: a.shares_count, baseline_price: a.baseline_price,
                    interest: a.stock.interest || 'not-interested', stock_id: a.stock.id,
                }))
                setDbStocks(formatted)
            }
            setInterestConfirmStock(null)
        } catch (error) {
            console.error('Error changing interest:', error)
        }
    }

    return (
        <div className="min-h-screen bg-[#020817] text-white">
            {/* ── Header ── */}
            <header className="sticky top-0 z-40 border-b border-blue-500/10 bg-[#020817]/95 backdrop-blur-xl">
                <div className="mx-auto max-w-7xl flex items-center px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        {/* Hamburger */}
                        <button
                            onClick={() => setShowNavMenu(!showNavMenu)}
                            className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-blue-400 hover:bg-blue-500/10 transition-colors"
                        >
                            <Menu className="h-5 w-5" />
                        </button>

                        {/* Logo */}
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
                </div>
            </header>

            {/* ── Slide-out Navigation Menu ── */}
            {showNavMenu && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={() => setShowNavMenu(false)}>
                    <div
                        className="absolute left-0 top-0 h-full w-72 border-r border-blue-500/10 bg-[#020817] p-6 shadow-2xl animate-slide-up"
                        onClick={e => e.stopPropagation()}
                    >
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
                            <button onClick={() => { router.push('/prctrendtracker'); setShowNavMenu(false) }} className="flex w-full items-center gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-blue-400 font-medium">
                                <BarChart3 className="h-5 w-5" /> PrcTrendTracker
                            </button>
                            <button onClick={() => { router.push('/journaledger'); setShowNavMenu(false) }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-gray-400 hover:bg-blue-500/5 hover:text-blue-400 transition-colors">
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

                {/* ── Controls Row ── */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:flex-wrap">
                    {/* View Selector Dropdown */}
                    <div className="relative">
                        <select
                            value={viewFilter}
                            onChange={(e) => setViewFilter(e.target.value)}
                            className="appearance-none rounded-xl border border-white/10 bg-white/5 pl-4 pr-10 py-2.5 text-sm font-medium text-white backdrop-blur-md cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            style={{ colorScheme: 'dark' }}
                        >
                            <option value="portfolio" className="bg-black">📊 Portfolio Stocks</option>
                            <option value="non-portfolio" className="bg-black">📋 Non-Portfolio Stocks</option>
                            {sectors.map((s) => (
                                <option key={s.id} value={s.id} className="bg-black">
                                    🏢 {s.name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>

                    {/* Search Bar */}
                    <div className="relative flex-1 min-w-0 max-w-md">
                        <div className="flex">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search company on screener.in..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full rounded-l-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-md"
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                disabled={searching}
                                className="rounded-r-xl border border-l-0 border-white/10 bg-blue-600/80 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                            >
                                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                            </button>
                        </div>

                        {/* Search dropdown results */}
                        {searchResults.length > 0 && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#111] shadow-2xl backdrop-blur-xl">
                                {searchResults.map((r, i) => {
                                    const dbMatch = dbStocks.find(
                                        s => s.company_name.toLowerCase() === r.name.toLowerCase()
                                    )
                                    const color = dbMatch
                                        ? dbMatch.is_portfolio
                                            ? 'text-green-400'
                                            : 'text-blue-400'
                                        : 'text-gray-400'

                                    return (
                                        <button
                                            key={i}
                                            onClick={() => handleSelectCompany(r)}
                                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                                        >
                                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${dbMatch?.is_portfolio
                                                ? 'bg-green-500/15'
                                                : dbMatch
                                                    ? 'bg-blue-500/15'
                                                    : 'bg-gray-500/15'
                                                }`}>
                                                {dbMatch?.is_portfolio
                                                    ? <Briefcase className="h-4 w-4 text-green-400" />
                                                    : dbMatch
                                                        ? <Building2 className="h-4 w-4 text-blue-400" />
                                                        : <Search className="h-4 w-4 text-gray-400" />
                                                }
                                            </div>
                                            <div>
                                                <p className={`text-sm font-semibold ${color}`}>{r.name}</p>
                                                <p className="text-xs text-gray-500">{r.slug}</p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Selected Company Card ── */}
                {selectedCompany && (
                    <div className={`mb-6 rounded-2xl border p-5 backdrop-blur-md transition-all ${selectedCompany.isPortfolio
                        ? 'border-green-500/30 bg-green-500/5'
                        : selectedCompany.isInDB
                            ? 'border-blue-500/30 bg-blue-500/5'
                            : 'border-gray-500/30 bg-gray-500/5'
                        }`}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${selectedCompany.isPortfolio
                                    ? 'bg-green-500/20'
                                    : selectedCompany.isInDB
                                        ? 'bg-blue-500/20'
                                        : 'bg-gray-500/20'
                                    }`}>
                                    {selectedCompany.isPortfolio
                                        ? <Briefcase className="h-6 w-6 text-green-400" />
                                        : selectedCompany.isInDB
                                            ? <Building2 className="h-6 w-6 text-blue-400" />
                                            : <Search className="h-6 w-6 text-gray-400" />
                                    }
                                </div>
                                <div>
                                    <h3 className={`text-lg font-bold ${selectedCompany.isPortfolio
                                        ? 'text-green-400'
                                        : selectedCompany.isInDB
                                            ? 'text-blue-400'
                                            : 'text-gray-300'
                                        }`}>
                                        {selectedCompany.name}
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        {selectedCompany.isPortfolio
                                            ? '✅ Portfolio Stock'
                                            : selectedCompany.isInDB
                                                ? '📋 In Watchlist (Non-Portfolio)'
                                                : '🔍 External Company'
                                        }
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => fetchTrend('1Y')}
                                    disabled={trendLoading}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 transition-all"
                                >
                                    {trendLoading && trendType === '1Y' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <TrendingUp className="h-4 w-4" />
                                    )}
                                    Latest1Y-1MTrend
                                </button>
                                <button
                                    onClick={() => fetchTrend('3Y')}
                                    disabled={trendLoading}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 transition-all"
                                >
                                    {trendLoading && trendType === '3Y' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <BarChart3 className="h-4 w-4" />
                                    )}
                                    Latest3Y-3MTrend
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedCompany(null)
                                        setSearchQuery('')
                                    }}
                                    className="rounded-xl border border-white/10 p-2.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Sector Summary (when a sector is selected) ── */}
                {isSectorView && sectorTotals && viewStocks.some(s => s.is_portfolio) && (
                    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4 backdrop-blur-md">
                            <p className="text-xs text-gray-400 mb-1">Total Investment</p>
                            <p className="text-lg font-bold text-white">
                                ₹{sectorTotals.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4 backdrop-blur-md">
                            <p className="text-xs text-gray-400 mb-1">Current Value</p>
                            <p className="text-lg font-bold text-white">
                                ₹{sectorTotals.totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                            {fetchingPrices && <p className="text-xs text-gray-500 mt-1">Updating...</p>}
                        </div>
                        <div className={`rounded-xl border border-white/10 p-4 backdrop-blur-md ${sectorTotals.gain >= 0
                            ? 'bg-gradient-to-br from-green-500/10 to-green-600/5'
                            : 'bg-gradient-to-br from-red-500/10 to-red-600/5'
                            }`}>
                            <p className="text-xs text-gray-400 mb-1">Gain / Loss</p>
                            <p className={`text-lg font-bold ${sectorTotals.gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {sectorTotals.gain >= 0 ? '+' : ''}₹{sectorTotals.gain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className={`rounded-xl border border-white/10 p-4 backdrop-blur-md ${sectorTotals.returnPct >= 0
                            ? 'bg-gradient-to-br from-green-500/10 to-green-600/5'
                            : 'bg-gradient-to-br from-red-500/10 to-red-600/5'
                            }`}>
                            <p className="text-xs text-gray-400 mb-1">Returns</p>
                            <p className={`text-lg font-bold ${sectorTotals.returnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {sectorTotals.returnPct >= 0 ? '+' : ''}{sectorTotals.returnPct.toFixed(2)}%
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Portfolio Analytics (when portfolio view) ── */}
                {viewFilter === 'portfolio' && viewStocks.length > 0 && (
                    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {(() => {
                            let totalInvested = 0
                            let totalCurrent = 0
                            viewStocks.forEach(s => {
                                if (s.shares_count && s.baseline_price) {
                                    const inv = s.baseline_price * s.shares_count
                                    totalInvested += inv
                                    totalCurrent += (livePrices[s.id] || s.baseline_price) * s.shares_count
                                }
                            })
                            const gain = totalCurrent - totalInvested
                            const pct = totalInvested > 0 ? (gain / totalInvested) * 100 : 0

                            return (
                                <>
                                    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4">
                                        <p className="text-xs text-gray-400 mb-1">Total Investment</p>
                                        <p className="text-lg font-bold text-white">₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4">
                                        <p className="text-xs text-gray-400 mb-1">Current Value</p>
                                        <p className="text-lg font-bold text-white">₹{totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                        {fetchingPrices && <p className="text-xs text-gray-500 mt-1">Updating...</p>}
                                    </div>
                                    <div className={`rounded-xl border border-white/10 p-4 ${gain >= 0 ? 'bg-gradient-to-br from-green-500/10 to-green-600/5' : 'bg-gradient-to-br from-red-500/10 to-red-600/5'}`}>
                                        <p className="text-xs text-gray-400 mb-1">Gain / Loss</p>
                                        <p className={`text-lg font-bold ${gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {gain >= 0 ? '+' : ''}₹{gain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                    <div className={`rounded-xl border border-white/10 p-4 ${pct >= 0 ? 'bg-gradient-to-br from-green-500/10 to-green-600/5' : 'bg-gradient-to-br from-red-500/10 to-red-600/5'}`}>
                                        <p className="text-xs text-gray-400 mb-1">Return %</p>
                                        <p className={`text-lg font-bold ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                        </p>
                                    </div>
                                </>
                            )
                        })()}
                    </div>
                )}

                {/* ── Stocks List ── */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {viewStocks.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                            <div className="mb-4 rounded-full bg-white/5 p-4">
                                <Filter className="h-8 w-8 text-gray-500" />
                            </div>
                            <h3 className="text-lg font-medium text-white">No stocks found</h3>
                            <p className="mt-1 text-sm text-gray-400">
                                {viewFilter === 'portfolio'
                                    ? 'No portfolio stocks. Add them from the dashboard.'
                                    : viewFilter === 'non-portfolio'
                                        ? 'No non-portfolio stocks found.'
                                        : 'No stocks in this sector.'
                                }
                            </p>
                        </div>
                    ) : (
                        viewStocks.map((stock) => {
                            const livePrice = livePrices[stock.id]
                            const change = livePrice && stock.baseline_price
                                ? ((livePrice - stock.baseline_price) / stock.baseline_price) * 100
                                : null

                            return (
                                <div
                                    key={stock.id}
                                    className={`relative overflow-hidden rounded-xl border p-5 backdrop-blur-lg transition-all ${(stock.interest === 'interested' || stock.is_portfolio)
                                        ? 'border-blue-500/20 bg-white/5 hover:border-blue-500/30 hover:bg-white/10'
                                        : 'border-gray-500/20 bg-gray-900/40 hover:border-gray-500/30 hover:bg-gray-900/60'
                                        }`}
                                >
                                    {/* Stock info */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h3 className={`text-base font-semibold ${(stock.interest === 'interested' || stock.is_portfolio) ? 'text-white' : 'text-gray-400'}`}>{stock.company_name}</h3>
                                                {stock.is_portfolio && (
                                                    <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                                                        Portfolio
                                                    </span>
                                                )}
                                                {stock.interest === 'interested' && !stock.is_portfolio && (
                                                    <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-300">
                                                        Interested
                                                    </span>
                                                )}
                                                {stock.interest !== 'interested' && !stock.is_portfolio && (
                                                    <span className="rounded-full bg-gray-500/20 px-2 py-0.5 text-xs font-medium text-gray-400">
                                                        Not-Interested
                                                    </span>
                                                )}
                                            </div>
                                            {stock.sector_name && (
                                                <p className="text-xs text-gray-500">Sector: {stock.sector_name}</p>
                                            )}
                                            {stock.is_portfolio && stock.shares_count && (
                                                <p className="text-xs text-blue-400 mt-0.5">Shares: {stock.shares_count}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Prices */}
                                    <div className="flex items-end justify-between mb-4">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Bought Price</p>
                                            <p className="text-xl font-bold text-white">₹{stock.baseline_price?.toLocaleString()}</p>
                                        </div>
                                        {livePrice && (
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500 mb-1">Current Price</p>
                                                <p className={`text-xl font-bold ${change && change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    ₹{livePrice.toLocaleString()}
                                                </p>
                                                {change !== null && (
                                                    <span className={`flex items-center justify-end gap-1 text-xs font-medium ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                        {Math.abs(change).toFixed(2)}%
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Investment details for portfolio stocks */}
                                    {stock.is_portfolio && stock.shares_count && stock.baseline_price && (
                                        <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-3 mb-3">
                                            <div>
                                                <p className="text-xs text-gray-500">Invested</p>
                                                <p className="text-sm font-semibold text-white">
                                                    ₹{(stock.baseline_price * stock.shares_count).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">Current Value</p>
                                                <p className="text-sm font-semibold text-white">
                                                    ₹{((livePrice || stock.baseline_price) * stock.shares_count).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Trend buttons + Chng2Interested */}
                                    <div className="flex gap-2 border-t border-white/5 pt-3">
                                        <button
                                            onClick={() => fetchTrendForStock(stock.company_name, '1Y')}
                                            disabled={trendLoading}
                                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600/15 px-3 py-2 text-xs font-medium text-blue-400 hover:bg-blue-600/25 transition-colors disabled:opacity-50"
                                        >
                                            <TrendingUp className="h-3 w-3" />
                                            1Y-1M Trend
                                        </button>
                                        <button
                                            onClick={() => fetchTrendForStock(stock.company_name, '3Y')}
                                            disabled={trendLoading}
                                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-purple-600/15 px-3 py-2 text-xs font-medium text-purple-400 hover:bg-purple-600/25 transition-colors disabled:opacity-50"
                                        >
                                            <BarChart3 className="h-3 w-3" />
                                            3Y-3M Trend
                                        </button>
                                        {stock.interest !== 'interested' && !stock.is_portfolio && (
                                            <button
                                                onClick={() => setInterestConfirmStock(stock)}
                                                className="flex items-center justify-center gap-1 rounded-lg bg-blue-600/15 px-2 py-2 text-xs font-medium text-blue-400 hover:bg-blue-600/25 transition-colors"
                                            >
                                                Chng2Interested
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </main>

            {/* ── Trend Modal ── */}
            {showTrendModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowTrendModal(false)}>
                    <div
                        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d0d] p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white">{trendCompanyName}</h2>
                                <p className="text-sm text-gray-400 mt-0.5">
                                    {trendType === '1Y' ? 'Latest 1-Year Monthly Trend' : 'Latest 3-Year Monthly Trend'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowTrendModal(false)}
                                className="rounded-lg border border-white/10 p-2 text-gray-400 hover:bg-white/5 hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* 1-Year View */}
                        {trendType === '1Y' && monthlyTrends.length > 0 && (
                            <div className="space-y-2">
                                {monthlyTrends.map((t, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${t.trendPercent >= 0
                                            ? 'border-green-500/20 bg-green-500/5'
                                            : 'border-red-500/20 bg-red-500/5'
                                            }`}
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-white">{t.month}</p>
                                            <p className="text-xs text-gray-400">
                                                ₹{Number(t.firstPrice).toFixed(2)} → ₹{Number(t.lastPrice).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className={`flex items-center gap-1.5 text-sm font-bold ${Number(t.trendPercent) >= 0 ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                            {Number(t.trendPercent) >= 0
                                                ? <TrendingUp className="h-4 w-4" />
                                                : <TrendingDown className="h-4 w-4" />
                                            }
                                            {Number(t.trendPercent) >= 0 ? '+' : ''}{Number(t.trendPercent).toFixed(2)}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 3-Year View */}
                        {trendType === '3Y' && threeYearTrends.length > 0 && (
                            <div className="space-y-3">
                                {threeYearTrends.filter(g => g.years.some(y => y.trendPercent !== null)).map((group, i) => (
                                    <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-sm font-bold text-white mb-3">{group.monthName}</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {group.years.map((yearData, j) => (
                                                <div
                                                    key={j}
                                                    className={`rounded-lg border px-3 py-2 text-center transition-all ${yearData.trendPercent === null
                                                        ? 'border-white/5 bg-white/5'
                                                        : yearData.trendPercent >= 0
                                                            ? 'border-green-500/20 bg-green-500/5'
                                                            : 'border-red-500/20 bg-red-500/5'
                                                        }`}
                                                >
                                                    <p className="text-xs text-gray-400 mb-1">{yearData.year}</p>
                                                    {yearData.trendPercent !== null ? (
                                                        <p className={`text-sm font-bold ${Number(yearData.trendPercent) >= 0 ? 'text-green-400' : 'text-red-400'
                                                            }`}>
                                                            {Number(yearData.trendPercent) >= 0 ? '+' : ''}{Number(yearData.trendPercent).toFixed(2)}%
                                                        </p>
                                                    ) : (
                                                        <p className="text-sm text-gray-500">N/A</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Empty state */}
                        {((trendType === '1Y' && monthlyTrends.length === 0) ||
                            (trendType === '3Y' && threeYearTrends.length === 0)) && (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <BarChart3 className="h-12 w-12 text-gray-500 mb-3" />
                                    <p className="text-gray-400">No trend data available</p>
                                </div>
                            )}
                    </div>
                </div>
            )}

            {/* ── Interest Change Confirmation ── */}
            {interestConfirmStock && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
                    onClick={() => setInterestConfirmStock(null)}
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
                                Mark <span className="font-semibold text-white">{interestConfirmStock.company_name}</span> as Interested? Alerts will be activated for this company.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setInterestConfirmStock(null)}
                                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleChangeInterest(interestConfirmStock)}
                                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Loading overlay for trend fetch ── */}
            {trendLoading && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#0d0d0d] px-8 py-6 shadow-2xl">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                        <p className="text-sm font-medium text-white">Fetching trend data...</p>
                        <p className="text-xs text-gray-400">Scraping screener.in</p>
                    </div>
                </div>
            )}
        </div>
    )
}
