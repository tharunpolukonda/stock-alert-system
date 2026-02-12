import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Loader2, X } from 'lucide-react'

interface SectorModalProps {
    onClose: () => void
    onSectorAdded: () => void
}

export function SectorModal({ onClose, onSectorAdded }: SectorModalProps) {
    const [sectorName, setSectorName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!sectorName.trim()) {
            setError('Sector name is required')
            return
        }

        setLoading(true)
        setError('')

        try {
            const { error: insertError } = await supabase
                .from('sectors')
                .insert({ name: sectorName.trim() })

            if (insertError) {
                if (insertError.code === '23505') {
                    setError('This sector already exists')
                } else {
                    setError(insertError.message)
                }
                return
            }

            // Success
            setSectorName('')
            onSectorAdded()
            onClose()
        } catch (err: any) {
            setError(err.message || 'Failed to add sector')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-lg border border-white/10 bg-black/90 p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Add New Sector</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                        disabled={loading}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">
                            Sector Name
                        </label>
                        <input
                            type="text"
                            value={sectorName}
                            onChange={(e) => setSectorName(e.target.value)}
                            placeholder="e.g., IT & Tech, Pharma, Banking"
                            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                            disabled={loading}
                            autoFocus
                        />
                        {error && (
                            <p className="text-sm text-red-400">{error}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading ? 'Adding...' : 'Add Sector'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
