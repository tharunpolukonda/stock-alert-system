'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function AuthButton({ onClick }: { onClick?: () => void }) {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)

    // If no onClick provided, maybe default to something or just be a button?
    // In this context, we want it to trigger the modal.

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="rounded-full bg-white px-6 py-2 font-medium text-black transition-colors hover:bg-gray-200"
        >
            Sign In
        </button>
    )
}
