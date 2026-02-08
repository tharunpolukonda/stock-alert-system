import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { SearchBar } from './SearchBar'

interface AlertFormProps {
    stockId?: string
    companyName?: string
    initialBaseline?: number
    initialGain?: number
    initialLoss?: number
    onSave: (data: any) => Promise<void>
    onCancel: () => void
}

export function AlertForm({
    stockId,
    companyName: initialCompanyName,
    initialBaseline = 0,
    initialGain = 10,
    initialLoss = 5,
    onSave,
    onCancel
}: AlertFormProps) {
    const [baseline, setBaseline] = useState(initialBaseline)
    const [gain, setGain] = useState(initialGain)
    const [loss, setLoss] = useState(initialLoss)
    const [loading, setLoading] = useState(false)

    // Internal state for stock selection
    const [selectedStock, setSelectedStock] = useState<{
        company_name: string,
        price: number
    } | null>(initialCompanyName ? { company_name: initialCompanyName, price: initialBaseline } : null)

    const handleSubmit = async () => {
        if (!selectedStock) {
            alert("Please search and select a company first.")
            return
        }

        setLoading(true)
        try {
            await onSave({
                stock_id: stockId,
                company_name: selectedStock.company_name,
                baseline_price: baseline,
                gain_threshold_percent: gain,
                loss_threshold_percent: loss
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
