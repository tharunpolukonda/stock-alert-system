'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, addDoc, doc, arrayUnion } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
    ArrowLeft, Menu, X, Loader2, LayoutDashboard, Bell, BarChart3, BookOpen,
    Newspaper, LogOut, CheckCircle2, AlertTriangle, Eye, ArrowRightCircle, Clock
} from 'lucide-react'

/* ── Color config ── */
const COLOR_OPTIONS = [
    { key: 'green', label: 'Green', points: '+2', hex: '#22c55e', bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400' },
    { key: 'red', label: 'Red', points: '-2', hex: '#ef4444', bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400' },
    { key: 'gold', label: 'Gold', points: '+4', hex: '#eab308', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-400' },
    { key: 'grey', label: 'Grey', points: '0', hex: '#9ca3af', bg: 'bg-gray-500/15', border: 'border-gray-500/30', text: 'text-gray-400' },
    { key: 'orange', label: 'Orange', points: '+1', hex: '#f97316', bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400' },
    { key: 'blue', label: 'Blue', points: '+6', hex: '#3b82f6', bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400' },
] as const

function getColorConfig(key: string) {
    return COLOR_OPTIONS.find(c => c.key === key) || COLOR_OPTIONS[3]
}

interface NewsItem {
    text: string
    color: string
    date: string
    source: string
}

interface PolledCompany {
    docId: string
    name: string
    news: NewsItem[]
    convert2tracker: boolean
    converted: boolean
    created_at: string
    newsLoaded: boolean
    converting: boolean
}

interface ConvertFormData {
    baseline_price: number
    gain_threshold: number
    loss_threshold: number
    sector_id: string
    is_portfolio: boolean
    interest: 'interested' | 'not-interested'
}

export default function PendingConvertPage() {
    const router = useRouter()
    const supabase = createClient()

    const [user, setUser] = useState<any>(null)
    const [showNavMenu, setShowNavMenu] = useState(false)
    const [loading, setLoading] = useState(true)

    // Companies
    const [convertYes, setConvertYes] = useState<PolledCompany[]>([])
    const [convertNo, setConvertNo] = useState<PolledCompany[]>([])
    const [activeTab, setActiveTab] = useState<'yes' | 'no'>('yes')

    // Convert2Existing modal
    const [showConvertModal, setShowConvertModal] = useState(false)
    const [selectedCompany, setSelectedCompany] = useState<PolledCompany | null>(null)
    const [convertForm, setConvertForm] = useState<ConvertFormData>({
        baseline_price: 0,
        gain_threshold: 10,
        loss_threshold: 5,
        sector_id: '',
        is_portfolio: false,
        interest: 'not-interested'
    })
    const [sectors, setSectors] = useState<{ id: string; name: string }[]>([])
    const [submittingConvert, setSubmittingConvert] = useState(false)

    // Confirmation
    const [showConfirmation, setShowConfirmation] = useState(false)

    /* ── Auth ── */
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/'); return }
            setUser(user)
        }
        getUser()
    }, [supabase, router])

    /* ── Fetch sectors ── */
    useEffect(() => {
        const fetchSectors = async () => {
            const { data } = await supabase.from('sectors').select('id, name').order('name', { ascending: true })
            if (data) setSectors(data)
        }
        fetchSectors()
    }, [supabase])

    /* ── Fetch polled companies ── */
    useEffect(() => {
        if (!user) return
        fetchPolledCompanies()
    }, [user])

    const fetchPolledCompanies = async () => {
        setLoading(true)
        try {
            const polledRef = collection(db, 'polled_companies')
            const snapshot = await getDocs(polledRef)

            const yesList: PolledCompany[] = []
            const noList: PolledCompany[] = []

            snapshot.forEach(docSnap => {
                const data = docSnap.data()
                if (data.converted) return // skip already converted

                const company: PolledCompany = {
                    docId: docSnap.id,
                    name: data.name,
                    news: data.news || [],
                    convert2tracker: data.convert2tracker || false,
                    converted: data.converted || false,
                    created_at: data.created_at || '',
                    newsLoaded: false,
                    converting: false,
                }

                if (company.convert2tracker) {
                    yesList.push(company)
                } else {
                    noList.push(company)
                }
            })

            setConvertYes(yesList)
            setConvertNo(noList)
        } catch (err) {
            console.error('Error fetching polled companies:', err)
        } finally {
            setLoading(false)
        }
    }

    /* ── Load News ── */
    const handleLoadNews = (docId: string, tab: 'yes' | 'no') => {
        const setter = tab === 'yes' ? setConvertYes : setConvertNo
        setter(prev => prev.map(c => c.docId === docId ? { ...c, newsLoaded: !c.newsLoaded } : c))
    }

    /* ── Open Promote to Watchlist (formerly Convert2Existing) ── */
    const handleOpenConvert = async (company: PolledCompany) => {
        setSelectedCompany(company)
        setConvertForm({
            baseline_price: 0,
            gain_threshold: 10,
            loss_threshold: 5,
            sector_id: '',
            is_portfolio: false,
            interest: 'not-interested'
        })

        // Check if company already exists in Supabase
        if (user) {
            try {
                const { data: existingStock } = await supabase
                    .from('stocks')
                    .select(`
                        id,
                        sector_id,
                        user_alerts (
                            baseline_price,
                            gain_threshold_percent,
                            loss_threshold_percent,
                            is_portfolio
                        )
                    `)
                    .eq('company_name', company.name)
                    .single()

                if (existingStock) {
                    const alert = existingStock.user_alerts?.[0]
                    setConvertForm({
                        baseline_price: alert?.baseline_price || 0,
                        gain_threshold: alert?.gain_threshold_percent || 10,
                        loss_threshold: alert?.loss_threshold_percent || 5,
                        sector_id: existingStock.sector_id || '',
                        is_portfolio: alert?.is_portfolio || false,
                        interest: 'interested'
                    })
                }
            } catch (err) {
                // Ignore errors, just proceed with defaults
                console.error('Error fetching existing stock data:', err)
            }
        }

        setShowConvertModal(true)
        setShowConfirmation(false)
    }

    /* ── Proceed to confirmation ── */
    const handleProceedConvert = () => {
        if (!convertForm.sector_id) {
            alert('Please select a sector.')
            return
        }
        if (convertForm.baseline_price <= 0) {
            alert('Please enter a valid baseline price.')
            return
        }
        setShowConfirmation(true)
    }

    /* ── Confirm Convert2Existing ── */
    const handleConfirmConvert = async () => {
        if (!user || !selectedCompany) return
        setSubmittingConvert(true)

        try {
            // 1. Upsert into Supabase stocks table
            const { data: stockData, error: stockError } = await supabase
                .from('stocks')
                .upsert({
                    company_name: selectedCompany.name,
                    symbol: 'NSE',
                    current_price: convertForm.baseline_price,
                    sector_id: convertForm.sector_id,
                    interest: convertForm.is_portfolio ? 'interested' : convertForm.interest
                }, { onConflict: 'company_name' })
                .select()
                .single()

            if (stockError) throw stockError

            // 2. Create/Update user_alerts entry
            const { error: alertError } = await supabase
                .from('user_alerts')
                .upsert({
                    user_id: user.id,
                    stock_id: stockData.id,
                    baseline_price: convertForm.baseline_price,
                    gain_threshold_percent: convertForm.gain_threshold,
                    loss_threshold_percent: convertForm.loss_threshold,
                    is_portfolio: convertForm.is_portfolio,
                    shares_count: null,
                    is_active: true
                }, { onConflict: 'user_id,stock_id' })

            if (alertError) throw alertError

            // 3. Copy news from polled_companies to companies collection in Firestore
            const companiesRef = collection(db, 'companies')
            const q = query(companiesRef, where('name', '==', selectedCompany.name))
            const snapshot = await getDocs(q)

            if (!snapshot.empty) {
                const existingDoc = doc(db, 'companies', snapshot.docs[0].id)
                const existingData = snapshot.docs[0].data()
                const existingNews = existingData.news || []
                await updateDoc(existingDoc, { news: [...existingNews, ...selectedCompany.news] })
            } else {
                await addDoc(companiesRef, {
                    name: selectedCompany.name,
                    notes: '',
                    news: selectedCompany.news
                })
            }

            // 4. Mark polled_companies doc as converted
            const polledDocRef = doc(db, 'polled_companies', selectedCompany.docId)
            await updateDoc(polledDocRef, { converted: true })

            // 5. Close modal and refresh
            setShowConvertModal(false)
            setShowConfirmation(false)
            setSelectedCompany(null)
            fetchPolledCompanies()
        } catch (err: any) {
            console.error('Error converting company:', err)
            alert(`Error converting company: ${err.message}`)
        } finally {
            setSubmittingConvert(false)
        }
    }

    /* ── Sign out ── */
    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/')
    }

    /* ── News list display ── */
    function NewsList({ news }: { news: NewsItem[] }) {
        // Color occurrence counter
        const counts: Record<string, number> = {}
        news.forEach(n => { if (n.color !== 'grey') counts[n.color] = (counts[n.color] || 0) + 1 })
        const occurrences = Object.entries(counts)

        return (
            <div className="space-y-3 mt-3">
                {occurrences.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {occurrences.map(([color, count]) => {
                            const cfg = getColorConfig(color)
                            return (
                                <span key={color} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.border} border ${cfg.text}`}>
                                    {cfg.label}: {count}
                                </span>
                            )
                        })}
                    </div>
                )}
                {news.map((n, i) => {
                    const cfg = getColorConfig(n.color)
                    return (
                        <div key={i} className={`rounded-lg border px-3 py-2 ${cfg.bg} ${cfg.border}`}>
                            <p className={`text-xs ${cfg.text}`}>
                                <span className="text-gray-500 font-medium mr-1.5">{n.date}</span>
                                {n.text}
                            </p>
                        </div>
                    )
                })}
                {news.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-3">No news entries yet.</p>
                )}
            </div>
        )
    }

    /* ── Company Card ── */
    function PendingCompanyCard({ company, tab }: { company: PolledCompany; tab: 'yes' | 'no' }) {
        return (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{company.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${company.convert2tracker
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-gray-500/20 text-gray-400'
                            }`}>
                            {company.convert2tracker ? 'Watchlist: Yes' : 'Watchlist: No'}
                        </span>
                    </div>
                    <span className="text-[10px] text-gray-500">{company.created_at}</span>
                </div>
                <div className="p-5 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => handleLoadNews(company.docId, tab)}
                            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                        >
                            <Eye className="h-3.5 w-3.5" />
                            {company.newsLoaded ? 'Hide News' : 'Load News'}
                        </button>
                        <button
                            onClick={() => handleOpenConvert(company)}
                            className="flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors"
                        >
                            <ArrowRightCircle className="h-3.5 w-3.5" />
                            Promote to Watchlist
                        </button>
                    </div>

                    {company.newsLoaded && <NewsList news={company.news} />}
                </div>
            </div>
        )
    }

    const activeList = activeTab === 'yes' ? convertYes : convertNo

    return (
        <div className="min-h-screen bg-[#020817] text-white">

            {/* ── Header ── */}
            <header className="sticky top-0 z-40 border-b border-purple-500/10 bg-[#020817]/95 backdrop-blur-xl">
                <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowNavMenu(!showNavMenu)} className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-blue-400 hover:bg-blue-500/10 transition-colors">
                            <Menu className="h-5 w-5" />
                        </button>
                        <Image src="/assets/HooxMainLogo-removebg-preview.png" alt="Hoox Logo" width={100} height={35} className="h-8 w-auto drop-shadow-lg cursor-pointer" onClick={() => router.push('/dashboard')} priority />
                        <div className="flex items-center gap-2 ml-2">
                            <Clock className="h-5 w-5 text-purple-400" />
                            <h1 className="text-lg font-bold text-purple-400 hidden sm:block">Pending Watchlist Review</h1>
                            <h1 className="text-lg font-bold text-purple-400 sm:hidden">Pending</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => router.push('/polldataonce')} className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                            News Polling
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
                            <button onClick={() => { router.push('/journaledger'); setShowNavMenu(false) }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-gray-400 hover:bg-blue-500/5 hover:text-blue-400 transition-colors">
                                <BookOpen className="h-5 w-5" /> Journal & Ledger
                            </button>
                            <button onClick={() => { router.push('/polldataonce'); setShowNavMenu(false) }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-gray-400 hover:bg-amber-500/5 hover:text-amber-400 transition-colors">
                                <Newspaper className="h-5 w-5" /> News Polling
                            </button>
                        </nav>
                        <div className="my-6 border-t border-blue-500/10" />
                        <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors">
                            <LogOut className="h-5 w-5" /> Sign Out
                        </button>
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
            <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">

                {/* Tab Switcher */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('yes')}
                        className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${activeTab === 'yes'
                            ? 'bg-purple-500/15 border border-purple-500/30 text-purple-400'
                            : 'border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        Watchlist Candidates ({convertYes.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('no')}
                        className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${activeTab === 'no'
                            ? 'bg-gray-500/15 border border-gray-500/30 text-gray-300'
                            : 'border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        <X className="h-4 w-4" />
                        Skipped ({convertNo.length})
                    </button>
                </div>

                {/* Company List */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                        <p className="text-sm text-gray-400">Loading polled companies...</p>
                    </div>
                ) : activeList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                        <div className="mb-4 rounded-full bg-white/5 p-4">
                            <Newspaper className="h-8 w-8 text-gray-500" />
                        </div>
                        <h3 className="text-lg font-medium text-white">No companies found</h3>
                        <p className="mt-1 text-sm text-gray-400">
                            {activeTab === 'yes'
                                ? 'No companies marked for conversion yet.'
                                : 'No companies in the not-convert list.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                        {activeList.map(company => (
                            <PendingCompanyCard key={company.docId} company={company} tab={activeTab} />
                        ))}
                    </div>
                )}
            </main>

            {/* ── Convert2Existing Modal ── */}
            {showConvertModal && selectedCompany && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => { setShowConvertModal(false); setShowConfirmation(false) }}>
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-green-500/30 bg-[#0a0a0f] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>

                        {!showConfirmation ? (
                            <>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/15">
                                        <ArrowRightCircle className="h-5 w-5 text-green-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white">Promote to Watchlist</h3>
                                        <p className="text-xs text-gray-400">{selectedCompany.name}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Baseline Price */}
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Baseline Price (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={convertForm.baseline_price}
                                            onChange={e => setConvertForm({ ...convertForm, baseline_price: parseFloat(e.target.value) || 0 })}
                                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                                            placeholder="Enter baseline price"
                                        />
                                    </div>

                                    {/* Thresholds */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-green-400 mb-1 block">Gain Threshold (%)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={convertForm.gain_threshold}
                                                onChange={e => setConvertForm({ ...convertForm, gain_threshold: parseFloat(e.target.value) || 0 })}
                                                className="w-full rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-2.5 text-sm text-green-400 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-red-400 mb-1 block">Loss Threshold (%)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={convertForm.loss_threshold}
                                                onChange={e => setConvertForm({ ...convertForm, loss_threshold: parseFloat(e.target.value) || 0 })}
                                                className="w-full rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                                            />
                                        </div>
                                    </div>

                                    {/* Sector */}
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Select Sector</label>
                                        <select
                                            value={convertForm.sector_id}
                                            onChange={e => setConvertForm({ ...convertForm, sector_id: e.target.value })}
                                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            style={{ colorScheme: 'dark' }}
                                        >
                                            <option value="" className="bg-black">Select a sector</option>
                                            {sectors.map(s => <option key={s.id} value={s.id} className="bg-black">{s.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Portfolio */}
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Portfolio</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" checked={!convertForm.is_portfolio} onChange={() => setConvertForm({ ...convertForm, is_portfolio: false })} className="h-3.5 w-3.5" />
                                                <span className="text-xs text-gray-300">No</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" checked={convertForm.is_portfolio} onChange={() => setConvertForm({ ...convertForm, is_portfolio: true, interest: 'interested' })} className="h-3.5 w-3.5" />
                                                <span className="text-xs text-gray-300">Yes</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Interest */}
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Interest</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" checked={convertForm.interest === 'not-interested'} onChange={() => setConvertForm({ ...convertForm, interest: 'not-interested' })} disabled={convertForm.is_portfolio} className="h-3.5 w-3.5" />
                                                <span className={`text-xs ${convertForm.is_portfolio ? 'text-gray-600' : 'text-gray-300'}`}>Not-Interested</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" checked={convertForm.interest === 'interested'} onChange={() => setConvertForm({ ...convertForm, interest: 'interested' })} disabled={convertForm.is_portfolio} className="h-3.5 w-3.5" />
                                                <span className={`text-xs ${convertForm.is_portfolio ? 'text-gray-600' : 'text-gray-300'}`}>Interested</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button onClick={() => { setShowConvertModal(false); setShowConfirmation(false) }} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">
                                        Cancel
                                    </button>
                                    <button onClick={handleProceedConvert} className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 transition-colors">
                                        Proceed
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* ── Confirmation ── */
                            <>
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
                                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white">Confirm Promotion</h3>
                                        <p className="text-xs text-gray-400">{selectedCompany.name} will be added to your stock watchlist</p>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="space-y-3 mb-6">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                                            <span className="text-gray-500">Baseline:</span>
                                            <span className="text-white font-bold ml-1">₹{convertForm.baseline_price}</span>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                                            <span className="text-gray-500">Sector:</span>
                                            <span className="text-white font-medium ml-1">{sectors.find(s => s.id === convertForm.sector_id)?.name || '—'}</span>
                                        </div>
                                        <div className="rounded-lg border border-green-500/10 bg-green-500/5 p-3">
                                            <span className="text-gray-500">Gain:</span>
                                            <span className="text-green-400 font-bold ml-1">+{convertForm.gain_threshold}%</span>
                                        </div>
                                        <div className="rounded-lg border border-red-500/10 bg-red-500/5 p-3">
                                            <span className="text-gray-500">Loss:</span>
                                            <span className="text-red-400 font-bold ml-1">-{convertForm.loss_threshold}%</span>
                                        </div>
                                    </div>

                                    {/* News preview */}
                                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                                        <p className="text-[10px] text-gray-500 mb-2 font-semibold">NEWS TO BE CARRIED OVER</p>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                            {selectedCompany.news.map((n, i) => {
                                                const cfg = getColorConfig(n.color)
                                                return (
                                                    <p key={i} className={`text-[11px] ${cfg.text}`}>
                                                        <span className="text-gray-500 mr-1">{n.date}</span> {n.text}
                                                    </p>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setShowConfirmation(false)} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">
                                        Back
                                    </button>
                                    <button
                                        onClick={handleConfirmConvert}
                                        disabled={submittingConvert}
                                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                                    >
                                        {submittingConvert ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        Confirm Promote
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
