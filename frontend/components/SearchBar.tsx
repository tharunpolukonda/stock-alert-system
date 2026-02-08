'use client'

import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBarProps {
    onSearchResult: (result: any) => void
}

export function SearchBar({ onSearchResult }: SearchBarProps) {
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!query.trim()) return

        setLoading(true)
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ company_name: query }),
            })

            const data = await response.json()
            onSearchResult(data)
        } catch (error) {
            console.error('Search failed:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSearch} className="relative w-full max-w-md">
            <div className="relative group">
                <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 opacity-30 blur transition group-hover:opacity-75"></div>
                <div className="relative flex items-center rounded-full bg-black/80 backdrop-blur-xl border border-white/10">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search stock (e.g., Tata Steel)..."
                        className="w-full bg-transparent px-6 py-3 text-white placeholder-gray-400 focus:outline-none"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="mr-3 rounded-full p-2 text-gray-400 transition-colors hover:text-white disabled:opacity-50"
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Search className="h-5 w-5" />
                        )}
                    </button>
                </div>
            </div>
        </form>
    )
}
