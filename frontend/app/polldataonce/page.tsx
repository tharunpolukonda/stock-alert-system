'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, addDoc, doc, arrayUnion } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
    ArrowLeft, Menu, X, Loader2, LayoutDashboard, Bell, BarChart3, BookOpen,
    Newspaper, LogOut, CheckCircle2, AlertTriangle, Pencil, Clock, HelpCircle,
    ChevronRight, Palette, FileText, ArrowRightCircle, Zap
} from 'lucide-react'

/* ── Color config ── */
const COLOR_OPTIONS = [
    { key: 'green', label: 'Green', points: '+2', hex: '#22c55e', bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400', ring: 'ring-green-500' },
    { key: 'red', label: 'Red', points: '-2', hex: '#ef4444', bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', ring: 'ring-red-500' },
    { key: 'gold', label: 'Gold', points: '+4', hex: '#eab308', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-400', ring: 'ring-yellow-500' },
    { key: 'grey', label: 'Grey', points: '0', hex: '#9ca3af', bg: 'bg-gray-500/15', border: 'border-gray-500/30', text: 'text-gray-400', ring: 'ring-gray-500' },
    { key: 'orange', label: 'Orange', points: '+1', hex: '#f97316', bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', ring: 'ring-orange-500' },
    { key: 'blue', label: 'Blue', points: '+6', hex: '#3b82f6', bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', ring: 'ring-blue-500' },
] as const

type ColorKey = typeof COLOR_OPTIONS[number]['key']

interface CompanyNews {
    company_name: string
    news: string
}

interface ProcessedCompany {
    company_name: string
    news: string
    editedNews: string
    selectedColor: ColorKey
    isPreExisting: boolean
    convert2Tracker: boolean
    submitted: boolean
    submitting: boolean
}

function getTodayDate(): string {
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yyyy = now.getFullYear()
    return `${dd}-${mm}-${yyyy}`
}

function getColorConfig(key: string) {
    return COLOR_OPTIONS.find(c => c.key === key) || COLOR_OPTIONS[3] // default grey
}

export default function PollDataOncePage() {
    const router = useRouter()
    const supabase = createClient()

    const [user, setUser] = useState<any>(null)
    const [showNavMenu, setShowNavMenu] = useState(false)

    // Step 1: JSON input
    const [jsonInput, setJsonInput] = useState('')
    const [jsonError, setJsonError] = useState('')
    const [processing, setProcessing] = useState(false)

    // Step 2: Processed companies
    const [processed, setProcessed] = useState(false)
    const [preExisting, setPreExisting] = useState<ProcessedCompany[]>([])
    const [newsPolled, setNewsPolled] = useState<ProcessedCompany[]>([])

    // QuickGuide modal
    const [showQuickGuide, setShowQuickGuide] = useState(false)

    /* ── Auth ── */
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/'); return }
            setUser(user)
        }
        getUser()
    }, [supabase, router])

    /* ── Sign out ── */
    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/')
    }

    /* ── Parse JSON and categorize ── */
    const handleProceed = async () => {
        setJsonError('')
        let parsed: any
        try {
            parsed = JSON.parse(jsonInput)
        } catch {
            setJsonError('Invalid JSON. Please check the format and try again.')
            return
        }

        const companyNews: CompanyNews[] = parsed.company_news || []
        if (companyNews.length === 0) {
            setJsonError('No company_news found in the JSON.')
            return
        }

        setProcessing(true)
        try {
            // Get all existing company names from Supabase stocks table
            const { data: existingStocks } = await supabase
                .from('stocks')
                .select('company_name')

            const existingNames = new Set(
                (existingStocks || []).map((s: any) => s.company_name.toLowerCase().trim())
            )

            // ── BUG FIX: Fetch existing polled_companies from Firestore ──
            // This lets us inherit the "Add to Watchlist" (convert2tracker) state
            // for companies that were previously polled
            const polledRef = collection(db, 'polled_companies')
            const polledSnapshot = await getDocs(polledRef)
            const polledCompanyMap = new Map<string, boolean>()
            polledSnapshot.forEach(docSnap => {
                const data = docSnap.data()
                polledCompanyMap.set(
                    (data.name || '').toLowerCase().trim(),
                    data.convert2tracker || false
                )
            })

            const preExistingList: ProcessedCompany[] = []
            const newsPolledList: ProcessedCompany[] = []

            for (const cn of companyNews) {
                // Look up previously saved convert2tracker state
                const previousConvertState = polledCompanyMap.get(cn.company_name.toLowerCase().trim()) || false

                const company: ProcessedCompany = {
                    company_name: cn.company_name,
                    news: cn.news,
                    editedNews: cn.news,
                    selectedColor: 'grey',
                    isPreExisting: false,
                    convert2Tracker: previousConvertState, // Inherit from Firestore
                    submitted: false,
                    submitting: false,
                }

                if (existingNames.has(cn.company_name.toLowerCase().trim())) {
                    company.isPreExisting = true
                    preExistingList.push(company)
                } else {
                    newsPolledList.push(company)
                }
            }

            setPreExisting(preExistingList)
            setNewsPolled(newsPolledList)
            setProcessed(true)
        } catch (err) {
            console.error('Error processing JSON:', err)
            setJsonError('Error processing companies. Please try again.')
        } finally {
            setProcessing(false)
        }
    }

    /* ── Submit news for a pre-existing company ── */
    const handleSubmitPreExisting = async (index: number) => {
        const company = preExisting[index]
        if (!company || company.submitted) return

        const updated = [...preExisting]
        updated[index] = { ...company, submitting: true }
        setPreExisting(updated)

        try {
            const newsEntry = {
                text: company.editedNews,
                color: company.selectedColor,
                date: getTodayDate(),
                source: 'poll'
            }

            // Check if company exists in Firestore companies collection
            const companiesRef = collection(db, 'companies')
            const q = query(companiesRef, where('name', '==', company.company_name))
            const snapshot = await getDocs(q)

            if (!snapshot.empty) {
                // Update existing doc — append to news array
                const docRef = doc(db, 'companies', snapshot.docs[0].id)
                const existingData = snapshot.docs[0].data()
                if (existingData.news) {
                    await updateDoc(docRef, { news: arrayUnion(newsEntry) })
                } else {
                    await updateDoc(docRef, { news: [newsEntry] })
                }
            } else {
                // Create new doc in companies collection
                await addDoc(companiesRef, {
                    name: company.company_name,
                    notes: '',
                    news: [newsEntry]
                })
            }

            const final_ = [...preExisting]
            final_[index] = { ...company, submitted: true, submitting: false }
            setPreExisting(final_)
        } catch (err) {
            console.error('Error submitting news:', err)
            alert('Failed to submit news. Please try again.')
            const revert = [...preExisting]
            revert[index] = { ...company, submitting: false }
            setPreExisting(revert)
        }
    }

    /* ── Submit news for a news-polled company ── */
    const handleSubmitNewsPolled = async (index: number) => {
        const company = newsPolled[index]
        if (!company || company.submitted) return

        const updated = [...newsPolled]
        updated[index] = { ...company, submitting: true }
        setNewsPolled(updated)

        try {
            const newsEntry = {
                text: company.editedNews,
                color: company.selectedColor,
                date: getTodayDate(),
                source: 'poll'
            }

            // Check if company already exists in polled_companies
            const polledRef = collection(db, 'polled_companies')
            const q = query(polledRef, where('name', '==', company.company_name))
            const snapshot = await getDocs(q)

            if (!snapshot.empty) {
                // Update existing doc
                const docRef = doc(db, 'polled_companies', snapshot.docs[0].id)
                const existingData = snapshot.docs[0].data()
                if (existingData.news) {
                    await updateDoc(docRef, {
                        news: arrayUnion(newsEntry),
                        convert2tracker: company.convert2Tracker
                    })
                } else {
                    await updateDoc(docRef, {
                        news: [newsEntry],
                        convert2tracker: company.convert2Tracker
                    })
                }
            } else {
                // Create new doc in polled_companies
                await addDoc(polledRef, {
                    name: company.company_name,
                    news: [newsEntry],
                    convert2tracker: company.convert2Tracker,
                    converted: false,
                    created_at: getTodayDate()
                })
            }

            const final_ = [...newsPolled]
            final_[index] = { ...company, submitted: true, submitting: false }
            setNewsPolled(final_)
        } catch (err) {
            console.error('Error submitting polled news:', err)
            alert('Failed to submit news. Please try again.')
            const revert = [...newsPolled]
            revert[index] = { ...company, submitting: false }
            setNewsPolled(revert)
        }
    }

    /* ── Update helpers ── */
    const updatePreExisting = (index: number, updates: Partial<ProcessedCompany>) => {
        const updated = [...preExisting]
        updated[index] = { ...updated[index], ...updates }
        setPreExisting(updated)
    }

    const updateNewsPolled = (index: number, updates: Partial<ProcessedCompany>) => {
        const updated = [...newsPolled]
        updated[index] = { ...updated[index], ...updates }
        setNewsPolled(updated)
    }

    /* ── Color Occurrence Counter ── */
    function ColorOccurrence({ companies }: { companies: ProcessedCompany[] }) {
        const counts: Record<string, number> = {}
        companies.filter(c => c.submitted).forEach(c => {
            counts[c.selectedColor] = (counts[c.selectedColor] || 0) + 1
        })
        const entries = Object.entries(counts).filter(([k]) => k !== 'grey')
        if (entries.length === 0) return null
        return (
            <div className="flex flex-wrap gap-2">
                {entries.map(([color, count]) => {
                    const cfg = getColorConfig(color)
                    return (
                        <span key={color} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.border} border ${cfg.text}`}>
                            {cfg.label}: {count}
                        </span>
                    )
                })}
            </div>
        )
    }

    /* ── Company Card ── */
    function CompanyCard({
        company,
        index,
        isPreExisting,
        onSubmit,
        onUpdate,
    }: {
        company: ProcessedCompany
        index: number
        isPreExisting: boolean
        onSubmit: (i: number) => void
        onUpdate: (i: number, u: Partial<ProcessedCompany>) => void
    }) {
        const selectedCfg = getColorConfig(company.selectedColor)

        return (
            <div className={`rounded-2xl border backdrop-blur-md overflow-hidden transition-all ${company.submitted
                ? 'border-green-500/30 bg-green-500/[0.03]'
                : 'border-white/10 bg-white/[0.02]'
                }`}>
                {/* Header */}
                <div className={`px-5 py-3 border-b flex items-center justify-between ${company.submitted ? 'border-green-500/10' : 'border-white/5'}`}>
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{company.company_name}</h3>
                        {isPreExisting ? (
                            <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400">Pre-Existing</span>
                        ) : (
                            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">News-Polled</span>
                        )}
                    </div>
                    {company.submitted && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                        </span>
                    )}
                </div>

                <div className="p-5 space-y-4">
                    {/* News text (editable) */}
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                            <Pencil className="h-3 w-3" /> News (editable)
                        </label>
                        <textarea
                            value={company.editedNews}
                            onChange={e => onUpdate(index, { editedNews: e.target.value })}
                            rows={3}
                            disabled={company.submitted}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none disabled:opacity-50"
                        />
                    </div>

                    {/* Color Picker */}
                    <div>
                        <label className="text-xs text-gray-400 mb-2 block">Select Color Code</label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {COLOR_OPTIONS.map(c => (
                                <button
                                    key={c.key}
                                    onClick={() => !company.submitted && onUpdate(index, { selectedColor: c.key })}
                                    disabled={company.submitted}
                                    className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all ${company.selectedColor === c.key
                                        ? `${c.bg} ${c.border} ring-2 ${c.ring}`
                                        : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                                        } ${company.submitted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c.hex }} />
                                    <span className={`text-[10px] font-semibold ${c.text}`}>{c.label}</span>
                                    <span className="text-[9px] text-gray-500">{c.points}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Add to Watchlist (only for news-polled) */}
                    {!isPreExisting && (
                        <div className="flex items-center gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                            <span className="text-xs font-semibold text-amber-400">Add to Watchlist</span>
                            <div className="flex gap-3">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={company.convert2Tracker}
                                        onChange={() => !company.submitted && onUpdate(index, { convert2Tracker: true })}
                                        disabled={company.submitted}
                                        className="h-3.5 w-3.5 text-amber-500"
                                    />
                                    <span className="text-xs text-gray-300">Yes</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={!company.convert2Tracker}
                                        onChange={() => !company.submitted && onUpdate(index, { convert2Tracker: false })}
                                        disabled={company.submitted}
                                        className="h-3.5 w-3.5 text-gray-400"
                                    />
                                    <span className="text-xs text-gray-300">No</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Preview */}
                    {!company.submitted && (
                        <div className={`rounded-xl border px-4 py-3 ${selectedCfg.bg} ${selectedCfg.border}`}>
                            <p className="text-[10px] text-gray-400 mb-1">Preview</p>
                            <p className={`text-sm font-medium ${selectedCfg.text}`}>
                                <span className="text-gray-500 mr-1">{getTodayDate()}</span>
                                {company.editedNews}
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    {!company.submitted && (
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => onUpdate(index, { editedNews: company.news, selectedColor: 'grey', convert2Tracker: false })}
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => onSubmit(index)}
                                disabled={company.submitting}
                                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white transition-colors disabled:opacity-50 ${selectedCfg.key === 'grey'
                                    ? 'bg-gray-600 hover:bg-gray-700'
                                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400'
                                    }`}
                            >
                                {company.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                Submit
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    /* ── QuickGuide Modal ── */
    function QuickGuideModal() {
        if (!showQuickGuide) return null

        return (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/85 backdrop-blur-sm overflow-y-auto p-4 sm:p-6" onClick={() => setShowQuickGuide(false)}>
                <div className="w-full max-w-3xl my-6 rounded-2xl border border-amber-500/20 bg-[#0a0a0f] shadow-2xl shadow-amber-500/5 overflow-hidden" onClick={e => e.stopPropagation()}>
                    {/* Guide Header */}
                    <div className="sticky top-0 z-10 bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-b border-amber-500/20 px-6 py-4 flex items-center justify-between backdrop-blur-xl">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                                <HelpCircle className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-amber-400">QuickGuide — News Polling</h2>
                                <p className="text-xs text-gray-400">Everything you need to know about this page</p>
                            </div>
                        </div>
                        <button onClick={() => setShowQuickGuide(false)} className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-8">
                        {/* Section 1: Overview */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold">1</div>
                                <h3 className="text-sm font-bold text-white">What is News Polling?</h3>
                            </div>
                            <div className="ml-9 rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    News Polling lets you <span className="text-amber-400 font-semibold">batch-process company news</span> by pasting a JSON input.
                                    The system automatically categorizes companies into two groups:
                                </p>
                                <div className="grid grid-cols-2 gap-2 mt-3">
                                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                                        <p className="text-[10px] font-bold text-blue-400 mb-1">PRE-EXISTING</p>
                                        <p className="text-[11px] text-gray-400">Companies already in your stock watchlist</p>
                                    </div>
                                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                                        <p className="text-[10px] font-bold text-amber-400 mb-1">NEWS-POLLED</p>
                                        <p className="text-[11px] text-gray-400">New companies not yet in your watchlist</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: How to Use */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold">2</div>
                                <h3 className="text-sm font-bold text-white">How to Use — Step by Step</h3>
                            </div>
                            <div className="ml-9 space-y-2">
                                <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <ChevronRight className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-white">Step 1: Paste JSON</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">Paste your news JSON containing a <code className="text-amber-400 bg-amber-500/10 px-1 rounded">company_news</code> array. Each entry needs <code className="text-amber-400 bg-amber-500/10 px-1 rounded">company_name</code> and <code className="text-amber-400 bg-amber-500/10 px-1 rounded">news</code> fields.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <ChevronRight className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-white">Step 2: Review & Color-Code</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">Each company card shows the news text (editable). Select a color code to categorize the news sentiment.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <ChevronRight className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-white">Step 3: Submit</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">Click &quot;Submit&quot; to save the news entry. Pre-existing companies save to the companies collection; news-polled companies save to the polled_companies collection.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <ChevronRight className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-white">Step 4: Bidirectional Flow</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5 text-balance">
                                            Promote polled companies to your main watchlist via <span className="text-purple-400">&quot;Pending Review&quot;</span>, or revert existing watchlist stocks back to news-polled status from their individual details page.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Color Codes */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold">3</div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Palette className="h-4 w-4 text-purple-400" /> Color Code System</h3>
                            </div>
                            <div className="ml-9 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                                <p className="text-xs text-gray-400 mb-3">Each color represents a sentiment level and carries a point value:</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {COLOR_OPTIONS.map(c => (
                                        <div key={c.key} className={`flex items-center gap-2 rounded-lg border p-2 ${c.bg} ${c.border}`}>
                                            <div className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                                            <div>
                                                <span className={`text-[11px] font-bold ${c.text}`}>{c.label}</span>
                                                <span className="text-[10px] text-gray-500 ml-1">({c.points} pts)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 rounded-lg border border-blue-500/10 bg-blue-500/5 p-2.5">
                                    <p className="text-[11px] text-blue-300">
                                        <span className="font-semibold">💡 Tip:</span> Blue (+6) is the highest positive signal, Gold (+4) is strong positive, Green (+2) is good, Orange (+1) is slightly positive, Grey (0) is neutral, and Red (-2) is negative.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Add to Watchlist */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold">4</div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2"><ArrowRightCircle className="h-4 w-4 text-amber-400" /> Add to Watchlist</h3>
                            </div>
                            <div className="ml-9 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4 space-y-2">
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    For <span className="text-amber-400 font-semibold">News-Polled</span> companies (not yet in your watchlist), you will see an <span className="text-amber-400 font-semibold">&quot;Add to Watchlist&quot;</span> option with Yes/No.
                                </p>
                                <ul className="space-y-1.5 text-[11px] text-gray-400">
                                    <li className="flex items-start gap-2"><Zap className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" /> Select <span className="text-green-400 font-semibold">Yes</span> if you want to eventually track this company in your main watchlist</li>
                                    <li className="flex items-start gap-2"><Zap className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" /> Select <span className="text-gray-300 font-semibold">No</span> if the news is just for reference</li>
                                    <li className="flex items-start gap-2"><Zap className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" /> <span className="text-blue-400 font-semibold">Your choice is remembered!</span> If you mark &quot;Yes&quot; on Day 1 and new news arrives on Day 5, it will automatically default to &quot;Yes&quot;</li>
                                </ul>
                            </div>
                        </div>

                        {/* Section 5: Pending Watchlist Review */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold">5</div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Clock className="h-4 w-4 text-purple-400" /> Pending Watchlist Review</h3>
                            </div>
                            <div className="ml-9 rounded-xl border border-purple-500/15 bg-purple-500/[0.03] p-4 space-y-2">
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    Click the <span className="text-purple-400 font-semibold">&quot;Pending Watchlist Review&quot;</span> button (always visible in the header) to see all news-polled companies organized by their watchlist status.
                                </p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <div className="rounded-lg border border-purple-500/15 bg-purple-500/5 p-2.5">
                                        <p className="text-[10px] font-bold text-purple-400 mb-0.5">Watchlist Candidates</p>
                                        <p className="text-[10px] text-gray-400">Companies marked &quot;Yes&quot; — ready to be promoted to the main watchlist</p>
                                    </div>
                                    <div className="rounded-lg border border-gray-500/15 bg-gray-500/5 p-2.5">
                                        <p className="text-[10px] font-bold text-gray-400 mb-0.5">Skipped</p>
                                        <p className="text-[10px] text-gray-400">Companies marked &quot;No&quot; — kept for news reference only</p>
                                    </div>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-2">
                                    From there, use the <span className="text-green-400 font-semibold">&quot;Promote to Watchlist&quot;</span> button to add a polled company into your main stock watchlist with baseline price, sector, and other settings.
                                </p>
                            </div>
                        </div>

                        {/* Section 6: Convert to News-Polled (Stock Reversion) */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold">6</div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2"><ArrowRightCircle className="h-4 w-4 text-amber-400 rotate-90" /> Convert to News-Polled</h3>
                            </div>
                            <div className="ml-9 rounded-xl border border-red-500/15 bg-red-500/[0.03] p-4 space-y-3">
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    Need to move a company from your main watchlist back to <span className="text-amber-400 font-semibold">News-Polled</span>? Use the <span className="text-red-400 font-medium whitespace-nowrap">&quot;Convert to News-Polled&quot;</span> button on the individual Stock Details page.
                                </p>

                                <div className="space-y-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertTriangle className="h-3 w-3 text-red-400" />
                                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Portfolio Guard & Requirements</p>
                                    </div>
                                    <p className="text-[11px] text-gray-400">To prevent data loss, the system blocks conversion if:</p>
                                    <ul className="list-disc list-inside text-[10px] text-gray-500 space-y-1 ml-1">
                                        <li>You still hold active <span className="text-white font-medium">Shares</span> in the company.</li>
                                        <li>The <span className="text-white font-medium">Total Invested</span> amount is greater than ₹0.</li>
                                        <li>The stock is marked as <span className="text-white font-medium">Portfolio: Yes</span>.</li>
                                    </ul>
                                </div>

                                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                                    <p className="text-[11px] text-blue-300">
                                        <span className="font-semibold text-blue-200">Re-Promotion Logic:</span> If you re-promote a reverted stock later, the system <span className="text-white">auto-fills</span> your previous baseline price, thresholds, and sector automatically!
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Section 7: Example Walkthrough */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold">7</div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2"><FileText className="h-4 w-4 text-green-400" /> Example Walkthrough</h3>
                            </div>
                            <div className="ml-9 rounded-xl border border-green-500/15 bg-green-500/[0.02] p-4 space-y-3">
                                <div className="rounded-lg border border-white/5 bg-black/30 p-3">
                                    <p className="text-[10px] font-bold text-gray-500 mb-1.5">SCENARIO</p>
                                    <p className="text-xs text-gray-300">You receive news JSON with 5 companies. 3 are already in your watchlist (Pre-Existing), and 2 are new (News-Polled).</p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-start gap-2 rounded-lg bg-white/[0.02] p-2.5">
                                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 shrink-0">Day 1</span>
                                        <p className="text-[11px] text-gray-300">
                                            You paste the JSON → see 3 Pre-Existing + 2 News-Polled cards.
                                            For &quot;ABC Industries&quot; (news-polled), you color-code the news as <span className="text-green-400">Green</span> and set <span className="text-amber-400">Add to Watchlist = Yes</span>. Submit.
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-2 rounded-lg bg-white/[0.02] p-2.5">
                                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 shrink-0">Day 5</span>
                                        <p className="text-[11px] text-gray-300">
                                            New JSON arrives with another news item for &quot;ABC Industries&quot;. When you process it, the <span className="text-amber-400">Add to Watchlist</span> option automatically shows <span className="text-green-400">Yes</span> (your Day 1 choice is remembered!). You color-code and submit.
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-2 rounded-lg bg-white/[0.02] p-2.5">
                                        <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-400 shrink-0">Later</span>
                                        <p className="text-[11px] text-gray-300">
                                            Go to <span className="text-purple-400">Pending Watchlist Review</span> → find &quot;ABC Industries&quot; under <span className="text-purple-400">Watchlist Candidates</span> tab → click <span className="text-green-400">Promote to Watchlist</span> → fill in baseline price, sector → confirm. The company and all its news are now in your main watchlist!
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Close Button */}
                        <div className="flex justify-center pt-2 pb-2">
                            <button
                                onClick={() => setShowQuickGuide(false)}
                                className="rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 hover:from-amber-500 hover:to-amber-400 transition-all"
                            >
                                Got it, let&apos;s go!
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020817] text-white">

            {/* ── Header ── */}
            <header className="sticky top-0 z-40 border-b border-amber-500/10 bg-[#020817]/95 backdrop-blur-xl">
                <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowNavMenu(!showNavMenu)} className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-blue-400 hover:bg-blue-500/10 transition-colors">
                            <Menu className="h-5 w-5" />
                        </button>
                        <Image src="/assets/HooxMainLogo-removebg-preview.png" alt="Hoox Logo" width={100} height={35} className="h-8 w-auto drop-shadow-lg cursor-pointer" onClick={() => router.push('/dashboard')} priority />
                        <div className="flex items-center gap-2 ml-2">
                            <Newspaper className="h-5 w-5 text-amber-400" />
                            <h1 className="text-lg font-bold text-amber-400">News Polling</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* QuickGuide Button — always visible */}
                        <button
                            onClick={() => setShowQuickGuide(true)}
                            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
                        >
                            <HelpCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">QuickGuide</span>
                        </button>
                        {/* Pending Watchlist Review — always visible */}
                        <button
                            onClick={() => router.push('/polldataonce/pendingconvert')}
                            className="flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm font-semibold text-purple-400 hover:bg-purple-500/20 transition-colors"
                        >
                            <Clock className="h-4 w-4" />
                            <span className="hidden sm:inline">Pending Watchlist Review</span>
                            <span className="sm:hidden">Pending</span>
                        </button>
                        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/10 transition-colors">
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
                            <button onClick={() => setShowNavMenu(false)} className="flex w-full items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-amber-400 font-medium">
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

            {/* ── QuickGuide Modal ── */}
            <QuickGuideModal />

            {/* ── Main Content ── */}
            <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">

                {!processed ? (
                    /* ── Step 1: JSON Input ── */
                    <div className="space-y-6">
                        <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.03] to-orange-500/[0.02] backdrop-blur-md overflow-hidden">
                            <div className="border-b border-amber-500/10 px-5 py-3">
                                <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                                    <Newspaper className="h-4 w-4" /> Paste News JSON
                                </h2>
                            </div>
                            <div className="p-5 space-y-4">
                                <p className="text-xs text-gray-400">
                                    Paste the JSON containing <code className="text-amber-400">company_news</code>, <code className="text-amber-400">market_news</code>, and <code className="text-amber-400">results</code>. Currently only company_news will be processed.
                                </p>
                                <textarea
                                    value={jsonInput}
                                    onChange={e => { setJsonInput(e.target.value); setJsonError('') }}
                                    rows={18}
                                    className="w-full rounded-xl border border-amber-500/20 bg-black/30 px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none font-mono"
                                    placeholder={'{\n  "company_news": [\n    {\n      "company_name": "Reliance Industries",\n      "news": "..."\n    }\n  ]\n}'}
                                />
                                {jsonError && (
                                    <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                                        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-red-400">{jsonError}</p>
                                    </div>
                                )}
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleProceed}
                                        disabled={processing || !jsonInput.trim()}
                                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 transition-all"
                                    >
                                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        Proceed
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Step 2: Company Cards ── */
                    <div className="space-y-8">

                        {/* Summary bar */}
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-400">
                                Pre-Existing: {preExisting.length}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-400">
                                News-Polled: {newsPolled.length}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 border border-green-500/30 px-3 py-1.5 text-xs font-semibold text-green-400">
                                Submitted: {preExisting.filter(c => c.submitted).length + newsPolled.filter(c => c.submitted).length} / {preExisting.length + newsPolled.length}
                            </span>
                            <button
                                onClick={() => router.push('/polldataonce/pendingconvert')}
                                className="ml-auto flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-400 hover:bg-purple-500/20 transition-colors"
                            >
                                <Clock className="h-3.5 w-3.5" />
                                Pending Watchlist Review
                            </button>
                            <button
                                onClick={() => { setProcessed(false); setPreExisting([]); setNewsPolled([]); setJsonInput('') }}
                                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/10 transition-colors"
                            >
                                New Poll
                            </button>
                        </div>

                        {/* ── Pre-Existing Companies ── */}
                        {preExisting.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                                        <LayoutDashboard className="h-5 w-5" /> Pre-Existing Companies
                                    </h2>
                                    <ColorOccurrence companies={preExisting} />
                                </div>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    {preExisting.map((company, i) => (
                                        <CompanyCard
                                            key={`pre-${i}`}
                                            company={company}
                                            index={i}
                                            isPreExisting={true}
                                            onSubmit={handleSubmitPreExisting}
                                            onUpdate={updatePreExisting}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── News-Polled Companies ── */}
                        {newsPolled.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                                        <Newspaper className="h-5 w-5" /> News-Polled Companies
                                    </h2>
                                    <ColorOccurrence companies={newsPolled} />
                                </div>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    {newsPolled.map((company, i) => (
                                        <CompanyCard
                                            key={`polled-${i}`}
                                            company={company}
                                            index={i}
                                            isPreExisting={false}
                                            onSubmit={handleSubmitNewsPolled}
                                            onUpdate={updateNewsPolled}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
