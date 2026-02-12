import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { SearchBar } from './SearchBar'
import { createClient } from '@/lib/supabase'

interface AlertFormProps {
    stockId?: string
    companyName?: string
    initialBaseline?: number
    initialGain?: number
    initialLoss?: number
    initialSectorId?: string
    initialIsPortfolio?: boolean
    initialSharesCount?: number
    onSave: (data: any) => Promise<void>
    onCancel: () => void
}

export function AlertForm({
    stockId,
    companyName: initialCompanyName,
    initialBaseline = 0,
    initialGain = 10,
    initialLoss = 5,
    initialSectorId = '',
    initialIsPortfolio = false,
    initialSharesCount = 0,
    onSave,
    onCancel
}: AlertFormProps) {
    const [baseline, setBaseline] = useState(initialBaseline)
    const [gain, setGain] = useState(initialGain)
    const [loss, setLoss] = useState(initialLoss)
    const [sectorId, setSectorId] = useState(initialSectorId)
    const [isPortfolio, setIsPortfolio] = useState(initialIsPortfolio)
    const [sharesCount, setSharesCount] = useState(initialSharesCount)
    const [loading, setLoading] = useState(false)
    const [sectors, setSectors] = useState<any[]>([])
    const supabase = createClient()

    // Internal state for stock selection
    const [selectedStock, setSelectedStock] = useState<{
        company_name: string,
        price: number
    } | null>(initialCompanyName ? { company_name: initialCompanyName, price: initialBaseline } : null)

    // Fetch sectors on mount
    useEffect(() => {
        fetchSectors()
    }, [])

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

    const handleSubmit = async () => {
        if (!selectedStock) {
            alert("Please search and select a company first.")
            return
        }

        if (!sectorId) {
            alert("Please select a sector.")
            return
        }

        if (isPortfolio && (!sharesCount || sharesCount <= 0)) {
            alert("Please enter the number of shares for portfolio stocks.")
            return
        }

        setLoading(true)
        try {
            await onSave({
                stock_id: stockId,
                company_name: selectedStock.company_name,
                baseline_price: baseline,
                gain_threshold_percent: gain,
                loss_threshold_percent: loss,
                sector_id: sectorId,
                is_portfolio: isPortfolio,
                shares_count: isPortfolio ? sharesCount : null
            })
        } finally {
            setLoading(false)
        }
    }

    const handleInternalSearch = (result: any) => {
        if (result.success) {
            setSelectedStock(result)
            setBaseline(result.price)
        }
    }

    return (
        <div className="space-y-4 rounded-lg bg-black/50 p-6 backdrop-blur-md border border-white/10 w-full max-w-md mx-auto relative shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">Configure Alert</h3>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Company Name</label>
                {/* Reusing SearchBar logic but purely as a lookup tool */}
                {!selectedStock ? (
                    <SearchBar onSearchResult={handleInternalSearch} />
                ) : (
                    <div className="flex items-center justify-between rounded-lg bg-white/5 p-3 border border-white/10">
                        <span className="font-bold text-white">{selectedStock.company_name}</span>
                        <button
                            onClick={() => setSelectedStock(null)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            Change
                        </button>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Baseline Price (₹)</label>
                <input
                    type="number"
                    step="0.01"
                    value={baseline}
                    onChange={(e) => setBaseline(parseFloat(e.target.value))}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                    required
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-green-400">Gain Threshold (%)</label>
                    <input
                        type="number"
                        step="0.1"
                        value={gain}
                        onChange={(e) => setGain(parseFloat(e.target.value))}
                        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-red-400">Loss Threshold (%)</label>
                    <input
                        type="number"
                        step="0.1"
                        value={loss}
                        onChange={(e) => setLoss(parseFloat(e.target.value))}
                        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Sector</label>
                <select
                    value={sectorId}
                    onChange={(e) => setSectorId(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                    required
                >
                    <option value="">Select a sector</option>
                    {sectors.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                            {sector.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Portfolio Stock</label>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="portfolio"
                            checked={!isPortfolio}
                            onChange={() => setIsPortfolio(false)}
                            className="h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-300">No</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="portfolio"
                            checked={isPortfolio}
                            onChange={() => setIsPortfolio(true)}
                            className="h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-300">Yes</span>
                    </label>
                </div>
            </div>

            {isPortfolio && (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Number of Shares</label>
                    <input
                        type="number"
                        min="1"
                        value={sharesCount}
                        onChange={(e) => setSharesCount(parseInt(e.target.value))}
                        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                        placeholder="Enter number of shares"
                        required
                    />
                </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-md px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
                    disabled={loading}
                >
                    Cancel
                </button>
                <button
                    type="button" // Important: type button to avoid form submission if wrapped
                    onClick={handleSubmit}
                    className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
                    disabled={loading}
                >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Alert
                </button>
            </div>
        </div>
    )
}
