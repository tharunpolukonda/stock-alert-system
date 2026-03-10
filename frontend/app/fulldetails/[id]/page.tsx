'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, addDoc, doc } from 'firebase/firestore'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import {
    ArrowLeft, Pencil, Trash2, Save, X, Loader2,
    TrendingUp, TrendingDown, BarChart3, Building2, Info,
    BookOpen, ShoppingCart, DollarSign, History,
    AlertTriangle, Menu, LayoutDashboard, Bell, LogOut, CheckCircle2,
    StickyNote, Plus
} from 'lucide-react'

/* ── Types ── */
interface StockFullDetails {
    alert_id: string
    stock_id: string
    company_name: string
    symbol: string
    sector_id: string
    sector_name: string
    interest: 'interested' | 'not-interested'
    baseline_price: number
    gain_threshold: number
    loss_threshold: number
    is_portfolio: boolean
    shares_count: number
    is_invested_previous?: boolean
    no_trans_records?: number
}

interface Transaction {
    id: string
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

interface StockRatios {
    price: number | null
    high: number | null
    low: number | null
    market_cap: string | null
    roe: string | null
    roce: string | null
    description: string | null
}

/* ── Delete Confirmation Modal ── */
function DeleteConfirmModal({ companyName, onConfirm, onCancel }: { companyName: string; onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onCancel}>
            <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#0d0d0d] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center mb-5">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
                        <AlertTriangle className="h-6 w-6 text-red-400" />
                    </div>
                    <h3 className="text-base font-bold text-white">Delete Company?</h3>
                    <p className="mt-1.5 text-sm text-gray-400">
                        This will permanently remove <span className="font-semibold text-white">{companyName}</span> and all its data.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors">Delete</button>
                </div>
            </div>
        </div>
    )
}

/* ── Page ── */
export default function FullDetailsPage() {
    const router = useRouter()
    const params = useParams()
    const alertId = params.id as string
    const supabase = createClient()

    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [stock, setStock] = useState<StockFullDetails | null>(null)
    const [sectors, setSectors] = useState<{ id: string; name: string }[]>([])

    // Edit mode
    const [editing, setEditing] = useState(false)
    const [editData, setEditData] = useState({
        baseline_price: 0,
        gain_threshold: 10,
        loss_threshold: 5,
        sector_id: '',
        interest: 'not-interested' as 'interested' | 'not-interested',
        is_portfolio: false,
        shares_count: 0,
    })
    const [saving, setSaving] = useState(false)

    // Delete
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Live price & portfolio analytics
    const [livePrice, setLivePrice] = useState<number | null>(null)
    const [fetchingLive, setFetchingLive] = useState(false)

    // Ratios
    const [ratios, setRatios] = useState<StockRatios | null>(null)
    const [ratiosLoading, setRatiosLoading] = useState(true)
    const [ratiosError, setRatiosError] = useState<string | null>(null)

    // Transaction history
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [txLoading, setTxLoading] = useState(true)

    // Profit/Loss booked for this stock
    const [profitBooked, setProfitBooked] = useState(0)
    const [lossBooked, setLossBooked] = useState(0)

    // Nav menu
    const [showNavMenu, setShowNavMenu] = useState(false)

    // Firestore Notes
    const [notesDocId, setNotesDocId] = useState<string | null>(null)
    const [notesContent, setNotesContent] = useState('')
    const [notesLoading, setNotesLoading] = useState(true)
    const [notesExists, setNotesExists] = useState(false)
    const [editingNotes, setEditingNotes] = useState(false)
    const [editNotesValue, setEditNotesValue] = useState('')
    const [savingNotes, setSavingNotes] = useState(false)
    const [addingNotes, setAddingNotes] = useState(false)
    const [newNotesValue, setNewNotesValue] = useState('')

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

    /* ── Fetch stock details ── */
    const fetchStockDetails = useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('user_alerts')
                .select(`
                    id,
                    baseline_price,
                    gain_threshold_percent,
                    loss_threshold_percent,
                    is_portfolio,
                    shares_count,
                    stock:stocks (
                        id,
                        company_name,
                        symbol,
                        interest,
                        sector:sectors (id, name)
                    )
                `)
                .eq('id', alertId)
                .eq('user_id', userId)
                .single()

            if (error) throw error
            if (!data) { router.push('/dashboard'); return }

            const s: StockFullDetails = {
                alert_id: data.id,
                stock_id: (data as any).stock.id,
                company_name: (data as any).stock.company_name,
                symbol: (data as any).stock.symbol || 'NSE',
                sector_id: (data as any).stock.sector?.id || '',
                sector_name: (data as any).stock.sector?.name || 'N/A',
                interest: (data as any).stock.interest || 'not-interested',
                baseline_price: data.baseline_price,
                gain_threshold: data.gain_threshold_percent,
                loss_threshold: data.loss_threshold_percent,
                is_portfolio: data.is_portfolio,
                shares_count: data.shares_count || 0,
            }

            // Also fetch transaction_records
            const { data: txRec } = await supabase
                .from('transaction_records')
                .select('is_invested_previous, no_trans_records')
                .eq('user_id', userId)
                .eq('stock_id', s.stock_id)
                .maybeSingle()

            if (txRec) {
                s.is_invested_previous = txRec.is_invested_previous
                s.no_trans_records = txRec.no_trans_records
            }

            setStock(s)
            setEditData({
                baseline_price: s.baseline_price,
                gain_threshold: s.gain_threshold,
                loss_threshold: s.loss_threshold,
                sector_id: s.sector_id,
                interest: s.interest,
                is_portfolio: s.is_portfolio,
                shares_count: s.shares_count,
            })
        } catch (err) {
            console.error('Error fetching stock details:', err)
            router.push('/dashboard')
        } finally {
            setLoading(false)
        }
    }, [alertId, supabase, router])

    useEffect(() => {
        if (user) fetchStockDetails(user.id)
    }, [user, fetchStockDetails])

    /* ── Fetch live price ── */
    const fetchLivePrice = useCallback(async () => {
        if (!stock) return
        setFetchingLive(true)
        try {
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')
            const res = await fetch(`${apiBase}/api/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({ company_name: stock.company_name }),
            })
            const result = await res.json()
            if (result.success) setLivePrice(result.price)
        } catch (err) {
            console.error('Failed to fetch live price:', err)
        } finally {
            setFetchingLive(false)
        }
    }, [stock])

    useEffect(() => {
        if (stock) fetchLivePrice()
    }, [stock, fetchLivePrice])

    /* ── Fetch ratios ── */
    useEffect(() => {
        if (!stock) return
        const fetchRatios = async () => {
            setRatiosLoading(true)
            try {
                const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')
                const res = await fetch(`${apiBase}/api/stock-details`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    cache: 'no-store',
                    body: JSON.stringify({ company_name: stock.company_name }),
                })
                if (!res.ok) throw new Error(`Server error: ${res.status}`)
                const data = await res.json()
                if (!data.success && !data.high && !data.low) {
                    setRatiosError(data.error || 'Failed to fetch ratios')
                } else {
                    setRatios(data)
                }
            } catch (err: any) {
                setRatiosError(err.message || 'Unknown error')
            } finally {
                setRatiosLoading(false)
            }
        }
        fetchRatios()
    }, [stock])

    /* ── Fetch transactions ── */
    useEffect(() => {
        if (!user || !stock) return
        const fetchTx = async () => {
            setTxLoading(true)
            try {
                const { data, error } = await supabase
                    .from('journal_ledger_history')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('stock_id', stock.stock_id)
                    .order('created_at', { ascending: true })

                if (error) throw error
                setTransactions((data || []).map((t: any) => ({
                    id: t.id,
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
                })))

                // Compute profit/loss booked from sell transactions
                let pBooked = 0, lBooked = 0
                    ; (data || []).forEach((t: any) => {
                        if (t.transaction_type === 'sell') {
                            const pl = t.profit_loss || 0
                            if (pl > 0) pBooked += pl
                            else if (pl < 0) lBooked += Math.abs(pl)
                        }
                    })
                setProfitBooked(pBooked)
                setLossBooked(lBooked)
            } catch (err) {
                console.error('Error fetching transactions:', err)
            } finally {
                setTxLoading(false)
            }
        }
        fetchTx()
    }, [user, stock, supabase])

    /* ── Save edit ── */
    const handleSave = async () => {
        if (!stock || !user) return
        setSaving(true)
        try {
            // Update user_alerts
            await supabase.from('user_alerts').update({
                baseline_price: editData.baseline_price,
                gain_threshold_percent: editData.gain_threshold,
                loss_threshold_percent: editData.loss_threshold,
                is_portfolio: editData.is_portfolio,
                shares_count: editData.is_portfolio ? editData.shares_count : null,
                updated_at: new Date().toISOString(),
            }).eq('id', alertId).eq('user_id', user.id)

            // Update stocks
            await supabase.from('stocks').update({
                sector_id: editData.sector_id,
                interest: editData.is_portfolio ? 'interested' : editData.interest,
            }).eq('id', stock.stock_id)

            setEditing(false)
            fetchStockDetails(user.id)
        } catch (err) {
            console.error('Error saving:', err)
            alert('Failed to save changes.')
        } finally {
            setSaving(false)
        }
    }

    /* ── Delete ── */
    const handleDelete = async () => {
        if (!stock || !user) return
        try {
            await supabase.from('user_alerts').delete().eq('id', alertId).eq('user_id', user.id)
            await supabase.from('stocks').delete().eq('id', stock.stock_id)
            router.push('/dashboard')
        } catch (err) {
            console.error('Error deleting:', err)
            alert('Failed to delete.')
        }
    }

    /* ── Sign out ── */
    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/')
    }

    /* ── Fetch Notes from Firestore ── */
    useEffect(() => {
        if (!stock) return
        const fetchNotes = async () => {
            setNotesLoading(true)
            try {
                const companiesRef = collection(db, 'companies')
                const q = query(companiesRef, where('name', '==', stock.company_name))
                const snapshot = await getDocs(q)

                if (!snapshot.empty) {
                    const docSnap = snapshot.docs[0]
                    const data = docSnap.data()
                    setNotesDocId(docSnap.id)
                    setNotesContent(data.notes || '')
                    setNotesExists(true)
                } else {
                    setNotesDocId(null)
                    setNotesContent('')
                    setNotesExists(false)
                }
            } catch (err) {
                console.error('Error fetching notes from Firestore:', err)
                setNotesExists(false)
            } finally {
                setNotesLoading(false)
            }
        }
        fetchNotes()
    }, [stock])

    /* ── Save Notes to Firestore ── */
    const handleSaveNotes = async () => {
        if (!notesDocId) return
        setSavingNotes(true)
        try {
            const docRef = doc(db, 'companies', notesDocId)
            await updateDoc(docRef, { notes: editNotesValue })
            setNotesContent(editNotesValue)
            setEditingNotes(false)
        } catch (err) {
            console.error('Error saving notes:', err)
            alert('Failed to save notes.')
        } finally {
            setSavingNotes(false)
        }
    }

    /* ── Add Notes (create new Firestore doc) ── */
    const handleAddNotes = async () => {
        if (!stock || !newNotesValue.trim()) {
            alert('Please enter some notes.')
            return
        }
        setSavingNotes(true)
        try {
            const companiesRef = collection(db, 'companies')
            const docRef = await addDoc(companiesRef, {
                name: stock.company_name,
                notes: newNotesValue.trim(),
            })
            setNotesDocId(docRef.id)
            setNotesContent(newNotesValue.trim())
            setNotesExists(true)
            setAddingNotes(false)
            setNewNotesValue('')
        } catch (err) {
            console.error('Error adding notes:', err)
            alert('Failed to add notes.')
        } finally {
            setSavingNotes(false)
        }
    }

    /* ── Computed values ── */
    const currentPrice = livePrice ?? ratios?.price ?? stock?.baseline_price ?? 0
    const totalInvestment = stock ? stock.baseline_price * stock.shares_count : 0
    const currentValue = stock ? currentPrice * stock.shares_count : 0
    const gainLoss = currentValue - totalInvestment
    const returnPct = totalInvestment > 0 ? (gainLoss / totalInvestment) * 100 : 0

    const pctFallenFromHigh = ratios?.high && ratios.high > 0 ? ((ratios.high - currentPrice) * 100) / ratios.high : null
    const pctGainedFromLow = ratios?.low && ratios.low > 0 ? ((currentPrice - ratios.low) * 100) / ratios.low : null

    const buyTx = transactions.filter(t => t.transaction_type === 'buy')
    const sellTx = transactions.filter(t => t.transaction_type === 'sell')

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#020817] text-white">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    <p className="text-sm text-gray-400">Loading details...</p>
                </div>
            </div>
        )
    }

    if (!stock) return null

    return (
        <div className="min-h-screen bg-[#020817] text-white">

            {/* ── Header ── */}
            <header className="sticky top-0 z-40 border-b border-blue-500/10 bg-[#020817]/95 backdrop-blur-xl">
                <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowNavMenu(!showNavMenu)} className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-blue-400 hover:bg-blue-500/10 transition-colors">
                            <Menu className="h-5 w-5" />
                        </button>
                        <Image src="/assets/HooxMainLogo-removebg-preview.png" alt="Hoox Logo" width={100} height={35} className="h-8 w-auto drop-shadow-lg cursor-pointer" onClick={() => router.push('/dashboard')} priority />
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => router.back()} className="flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/10 transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                            Back
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

                {/* ── Title Bar ── */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h1 className="text-2xl font-bold text-white lg:text-3xl">{stock.company_name}</h1>
                            {stock.is_portfolio && (
                                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-400">Portfolio</span>
                            )}
                            {stock.interest === 'interested' && !stock.is_portfolio && (
                                <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300">Interested</span>
                            )}
                            {stock.interest === 'not-interested' && !stock.is_portfolio && (
                                <span className="rounded-full bg-gray-500/20 px-3 py-1 text-xs font-semibold text-gray-400">Not-Interested</span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                            <span>{stock.symbol}</span>
                            <span className="text-gray-600">•</span>
                            <span>Sector: {stock.sector_name}</span>
                            {stock.is_portfolio && <><span className="text-gray-600">•</span><span className="text-blue-400">Shares: {stock.shares_count}</span></>}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                        {!editing ? (
                            <>
                                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors">
                                    <Pencil className="h-4 w-4" /> Edit
                                </button>
                                <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors">
                                    <Trash2 className="h-4 w-4" /> Delete
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                                </button>
                                <button onClick={() => { setEditing(false); if (stock) setEditData({ baseline_price: stock.baseline_price, gain_threshold: stock.gain_threshold, loss_threshold: stock.loss_threshold, sector_id: stock.sector_id, interest: stock.interest, is_portfolio: stock.is_portfolio, shares_count: stock.shares_count }) }} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">
                                    <X className="h-4 w-4" /> Cancel
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Alert Configuration ── */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md overflow-hidden">
                    <div className="border-b border-white/5 px-5 py-3">
                        <h2 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                            <Bell className="h-4 w-4 text-blue-400" /> Alert Configuration
                        </h2>
                    </div>
                    <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {/* Baseline Price */}
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Baseline Price</p>
                            {editing ? (
                                <input type="number" step="0.01" value={editData.baseline_price} onChange={e => setEditData({ ...editData, baseline_price: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                            ) : (
                                <p className="text-xl font-bold text-white">₹{stock.baseline_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                            )}
                        </div>

                        {/* Current Price */}
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Current Price</p>
                            <div className="flex items-center gap-2">
                                <p className={cn('text-xl font-bold', currentPrice >= stock.baseline_price ? 'text-green-400' : 'text-red-400')}>
                                    ₹{currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </p>
                                {fetchingLive && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
                            </div>
                        </div>

                        {/* Gain Threshold */}
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Gain Threshold</p>
                            {editing ? (
                                <input type="number" step="0.1" value={editData.gain_threshold} onChange={e => setEditData({ ...editData, gain_threshold: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm font-bold text-green-400 focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                            ) : (
                                <p className="text-lg font-bold text-green-400 flex items-center gap-1">
                                    <TrendingUp className="h-4 w-4" /> +{stock.gain_threshold}%
                                </p>
                            )}
                        </div>

                        {/* Loss Threshold */}
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Loss Threshold</p>
                            {editing ? (
                                <input type="number" step="0.1" value={editData.loss_threshold} onChange={e => setEditData({ ...editData, loss_threshold: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm font-bold text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/50" />
                            ) : (
                                <p className="text-lg font-bold text-red-400 flex items-center gap-1">
                                    <TrendingDown className="h-4 w-4" /> -{stock.loss_threshold}%
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Edit mode: more fields */}
                    {editing && (
                        <div className="border-t border-white/5 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {/* Sector */}
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Sector</p>
                                <select value={editData.sector_id} onChange={e => setEditData({ ...editData, sector_id: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" style={{ colorScheme: 'dark' }}>
                                    <option value="" className="bg-black">Select sector</option>
                                    {sectors.map(s => <option key={s.id} value={s.id} className="bg-black">{s.name}</option>)}
                                </select>
                            </div>

                            {/* Interest */}
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Interest</p>
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" checked={editData.interest === 'interested'} onChange={() => setEditData({ ...editData, interest: 'interested' })} disabled={editData.is_portfolio} className="h-3.5 w-3.5 text-blue-600" />
                                        <span className="text-xs text-gray-300">Interested</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" checked={editData.interest === 'not-interested'} onChange={() => setEditData({ ...editData, interest: 'not-interested' })} disabled={editData.is_portfolio} className="h-3.5 w-3.5 text-gray-400" />
                                        <span className="text-xs text-gray-300">Not-Interested</span>
                                    </label>
                                </div>
                            </div>

                            {/* Portfolio Toggle */}
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Portfolio Stock</p>
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" checked={editData.is_portfolio} onChange={() => { setEditData({ ...editData, is_portfolio: true, interest: 'interested' }) }} className="h-3.5 w-3.5 text-blue-600" />
                                        <span className="text-xs text-gray-300">Yes</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" checked={!editData.is_portfolio} onChange={() => setEditData({ ...editData, is_portfolio: false })} className="h-3.5 w-3.5 text-gray-400" />
                                        <span className="text-xs text-gray-300">No</span>
                                    </label>
                                </div>
                            </div>

                            {/* Shares Count */}
                            {editData.is_portfolio && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Shares Count</p>
                                    <input type="number" min="1" value={editData.shares_count} onChange={e => setEditData({ ...editData, shares_count: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Portfolio Stats (only for portfolio stocks) ── */}
                {stock.is_portfolio && stock.shares_count > 0 && (
                    <div className="rounded-2xl border border-blue-500/15 bg-gradient-to-br from-blue-500/[0.03] to-indigo-500/[0.02] backdrop-blur-md overflow-hidden">
                        <div className="border-b border-blue-500/10 px-5 py-3">
                            <h2 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" /> Portfolio Analytics
                            </h2>
                        </div>
                        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                                <p className="text-[10px] text-gray-400 mb-0.5">Total Investment</p>
                                <p className="text-base font-bold text-white">₹{totalInvestment.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                            </div>
                            <div className="rounded-xl border border-blue-500/20 bg-indigo-500/5 p-3">
                                <p className="text-[10px] text-gray-400 mb-0.5">Current Value</p>
                                <p className="text-base font-bold text-white">₹{currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                {fetchingLive && <p className="text-[10px] text-gray-500 mt-0.5">Updating...</p>}
                            </div>
                            <div className={cn('rounded-xl border p-3', gainLoss >= 0 ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5')}>
                                <p className="text-[10px] text-gray-400 mb-0.5">Gain / Loss</p>
                                <p className={cn('text-base font-bold', gainLoss >= 0 ? 'text-green-400' : 'text-red-400')}>
                                    {gainLoss >= 0 ? '+' : ''}₹{gainLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                            <div className={cn('rounded-xl border p-3', returnPct >= 0 ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5')}>
                                <p className="text-[10px] text-gray-400 mb-0.5">Return %</p>
                                <p className={cn('text-base font-bold', returnPct >= 0 ? 'text-green-400' : 'text-red-400')}>
                                    {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
                                </p>
                            </div>
                            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                                <p className="text-[10px] text-gray-400 mb-0.5">Profit Booked</p>
                                <p className="text-base font-bold text-green-400">+₹{profitBooked.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                            </div>
                            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                                <p className="text-[10px] text-gray-400 mb-0.5">Loss Booked</p>
                                <p className="text-base font-bold text-red-400">-₹{lossBooked.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Other Ratios ── */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md overflow-hidden">
                    <div className="border-b border-white/5 px-5 py-3">
                        <h2 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" /> Other Ratios
                        </h2>
                    </div>
                    <div className="p-5 space-y-4">
                        {ratiosLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                                <p className="text-sm">Fetching ratios from screener.in…</p>
                            </div>
                        ) : ratiosError ? (
                            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-red-400">Could not load ratios</p>
                                    <p className="text-xs text-red-300/80 mt-0.5">{ratiosError}</p>
                                </div>
                            </div>
                        ) : ratios ? (
                            <>
                                {/* 52-Week High / Low */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <TrendingDown className="h-4 w-4 text-red-400" />
                                            <span className="text-xs text-gray-400">52-Week High</span>
                                        </div>
                                        <p className="text-xl font-bold text-white">{ratios.high != null ? `₹${ratios.high.toLocaleString('en-IN')}` : '—'}</p>
                                        {pctFallenFromHigh != null && (
                                            <div className="mt-2">
                                                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', pctFallenFromHigh > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400')}>
                                                    <TrendingDown className="h-3 w-3" />
                                                    {pctFallenFromHigh > 0 ? '▼' : '▲'} {Math.abs(pctFallenFromHigh).toFixed(2)}% from High
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <TrendingUp className="h-4 w-4 text-green-400" />
                                            <span className="text-xs text-gray-400">52-Week Low</span>
                                        </div>
                                        <p className="text-xl font-bold text-white">{ratios.low != null ? `₹${ratios.low.toLocaleString('en-IN')}` : '—'}</p>
                                        {pctGainedFromLow != null && (
                                            <div className="mt-2">
                                                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', pctGainedFromLow >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                                                    <TrendingUp className="h-3 w-3" />
                                                    {pctGainedFromLow >= 0 ? '▲' : '▼'} {Math.abs(pctGainedFromLow).toFixed(2)}% from Low
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Market Cap / ROE / ROCE */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                                        <p className="text-[10px] text-gray-500 mb-1">Market Cap</p>
                                        <p className="text-sm font-bold text-white break-words">{ratios.market_cap ?? '—'}</p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                                        <p className="text-[10px] text-gray-500 mb-1">ROE</p>
                                        <p className={cn('text-sm font-bold', ratios.roe ? 'text-blue-400' : 'text-white')}>{ratios.roe ?? '—'}</p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                                        <p className="text-[10px] text-gray-500 mb-1">ROCE</p>
                                        <p className={cn('text-sm font-bold', ratios.roce ? 'text-purple-400' : 'text-white')}>{ratios.roce ?? '—'}</p>
                                    </div>
                                </div>

                                {/* Description */}
                                {ratios.description && (
                                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Building2 className="h-4 w-4 text-gray-400" />
                                            <span className="text-xs font-semibold text-gray-300">About the Company</span>
                                        </div>
                                        <p className="text-xs text-gray-400 leading-relaxed line-clamp-6 hover:line-clamp-none transition-all cursor-pointer">
                                            {ratios.description}
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                                    <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-blue-300/80 leading-relaxed">
                                        Data sourced from <strong>screener.in</strong>. High/Low are 52-week figures. Percentages are relative to the current market price.
                                    </p>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>

                {/* ── Transaction History ── */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md overflow-hidden">
                    <div className="border-b border-white/5 px-5 py-3">
                        <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                            <History className="h-4 w-4" /> Journal & Ledger — Transaction History
                        </h2>
                    </div>
                    <div className="p-5">
                        {txLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                                <p className="text-sm">Loading transactions...</p>
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="mb-3 rounded-full bg-white/5 p-3">
                                    <History className="h-6 w-6 text-gray-500" />
                                </div>
                                <p className="text-sm text-gray-400">No transactions recorded for this company.</p>
                            </div>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-2">
                                {/* Bought Records */}
                                <div>
                                    <h3 className="text-sm font-bold text-green-400 mb-3 flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4" /> Bought Shares ({buyTx.length})
                                    </h3>
                                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                        {buyTx.length === 0 ? (
                                            <p className="text-xs text-gray-500 text-center py-4">No buy records.</p>
                                        ) : buyTx.map(tx => (
                                            <div key={tx.id} className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                                                        <ShoppingCart className="h-3 w-3" /> BUY
                                                    </span>
                                                    <span className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString('en-IN')}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div><span className="text-gray-400">Buy Price: </span><span className="text-white font-medium">₹{tx.transaction_price.toLocaleString()}</span></div>
                                                    <div><span className="text-gray-400">Shares: </span><span className="text-white font-medium">{tx.num_shares}</span></div>
                                                    <div><span className="text-gray-400">Prev Baseline: </span><span className="text-gray-300">₹{tx.previous_baseline_price.toLocaleString()}</span></div>
                                                    <div><span className="text-gray-400">New Baseline: </span><span className="text-white font-medium">₹{tx.updated_baseline_price.toLocaleString()}</span></div>
                                                    <div><span className="text-gray-400">Prev Shares: </span><span className="text-gray-300">{tx.previous_shares_count}</span></div>
                                                    <div><span className="text-gray-400">New Shares: </span><span className="text-white font-medium">{tx.updated_shares_count}</span></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Sold Records */}
                                <div>
                                    <h3 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                                        <DollarSign className="h-4 w-4" /> Sold Shares ({sellTx.length})
                                    </h3>
                                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                        {sellTx.length === 0 ? (
                                            <p className="text-xs text-gray-500 text-center py-4">No sell records.</p>
                                        ) : sellTx.map(tx => (
                                            <div key={tx.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                                                        <DollarSign className="h-3 w-3" /> SELL
                                                    </span>
                                                    <span className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString('en-IN')}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div><span className="text-gray-400">Sell Price: </span><span className="text-white font-medium">₹{tx.transaction_price.toLocaleString()}</span></div>
                                                    <div><span className="text-gray-400">Shares: </span><span className="text-white font-medium">{tx.num_shares}</span></div>
                                                    <div><span className="text-gray-400">Baseline: </span><span className="text-gray-300">₹{tx.previous_baseline_price.toLocaleString()}</span></div>
                                                    <div>
                                                        <span className="text-gray-400">P/L per Share: </span>
                                                        <span className={cn('font-medium', tx.profit_loss_per_share >= 0 ? 'text-green-400' : 'text-red-400')}>
                                                            {tx.profit_loss_per_share >= 0 ? '+' : ''}₹{tx.profit_loss_per_share.toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div><span className="text-gray-400">Prev Shares: </span><span className="text-gray-300">{tx.previous_shares_count}</span></div>
                                                    <div><span className="text-gray-400">New Shares: </span><span className="text-white font-medium">{tx.updated_shares_count}</span></div>
                                                    <div className="col-span-2 mt-1 pt-1 border-t border-red-500/10">
                                                        <span className="text-gray-400">Total P/L: </span>
                                                        <span className={cn('font-bold', tx.profit_loss >= 0 ? 'text-green-400' : 'text-red-400')}>
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
                </div>

                {/* ── Notes Section (Firestore) ── */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md overflow-hidden">
                    <div className="border-b border-white/5 px-5 py-3 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                            <StickyNote className="h-4 w-4" /> Notes
                        </h2>
                        {notesExists && !editingNotes && (
                            <button
                                onClick={() => { setEditingNotes(true); setEditNotesValue(notesContent) }}
                                className="flex items-center gap-1 rounded-lg bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                            >
                                <Pencil className="h-3 w-3" /> Edit Notes
                            </button>
                        )}
                    </div>
                    <div className="p-5">
                        {notesLoading ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
                                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                                <p className="text-sm">Loading notes...</p>
                            </div>
                        ) : notesExists ? (
                            /* Notes exist — show content or edit form */
                            editingNotes ? (
                                <div className="space-y-3">
                                    <textarea
                                        value={editNotesValue}
                                        onChange={e => setEditNotesValue(e.target.value)}
                                        rows={5}
                                        className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                                        placeholder="Enter your notes..."
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => setEditingNotes(false)}
                                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveNotes}
                                            disabled={savingNotes}
                                            className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50 transition-colors"
                                        >
                                            {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                            Save Notes
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/5 px-5 py-4">
                                    <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{notesContent || 'No notes written yet.'}</p>
                                </div>
                            )
                        ) : (
                            /* No notes in Firestore — show add notes prompt */
                            !addingNotes ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <div className="mb-3 rounded-full bg-white/5 p-3">
                                        <StickyNote className="h-6 w-6 text-gray-500" />
                                    </div>
                                    <p className="text-sm text-gray-400 mb-4">
                                        No notes present for <span className="font-semibold text-white">{stock.company_name}</span>. Want to add notes?
                                    </p>
                                    <button
                                        onClick={() => setAddingNotes(true)}
                                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-cyan-400 transition-all"
                                    >
                                        <Plus className="h-4 w-4" /> Add Notes
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <textarea
                                        value={newNotesValue}
                                        onChange={e => setNewNotesValue(e.target.value)}
                                        rows={5}
                                        className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                                        placeholder={`Write notes for ${stock.company_name}...`}
                                        autoFocus
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => { setAddingNotes(false); setNewNotesValue('') }}
                                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleAddNotes}
                                            disabled={savingNotes}
                                            className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50 transition-colors"
                                        >
                                            {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                            Save Notes
                                        </button>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>

            </main>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <DeleteConfirmModal
                    companyName={stock.company_name}
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </div>
    )
}
