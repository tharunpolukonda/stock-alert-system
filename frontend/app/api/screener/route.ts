import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    try {
        if (action === 'search') {
            // Search for a company on screener.in
            const query = searchParams.get('q')
            if (!query) {
                return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 })
            }

            const res = await fetch(
                `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}`,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json',
                    },
                }
            )

            if (!res.ok) {
                return NextResponse.json({ error: `Screener search failed: ${res.status}` }, { status: res.status })
            }

            const data = await res.json()
            return NextResponse.json(data)

        } else if (action === 'chart') {
            // Fetch chart data for a company
            const companyId = searchParams.get('id')
            const days = searchParams.get('days') || '365'

            if (!companyId) {
                return NextResponse.json({ error: 'Missing company id' }, { status: 400 })
            }

            const res = await fetch(
                `https://www.screener.in/api/company/${companyId}/chart/?q=Price-DMA50-DMA200-Volume&days=${days}&consolidated=true`,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json',
                    },
                }
            )

            if (!res.ok) {
                return NextResponse.json({ error: `Screener chart failed: ${res.status}` }, { status: res.status })
            }

            const data = await res.json()
            return NextResponse.json(data)

        } else if (action === 'companyId') {
            // Fetch the company page to extract the data-company-id
            const slug = searchParams.get('slug')
            if (!slug) {
                return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 })
            }

            const res = await fetch(
                `https://www.screener.in/company/${slug}/consolidated/`,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html',
                    },
                }
            )

            if (!res.ok) {
                return NextResponse.json({ error: `Screener page failed: ${res.status}` }, { status: res.status })
            }

            const html = await res.text()
            // Extract data-company-id from HTML
            const match = html.match(/data-company-id="(\d+)"/)
            if (match) {
                return NextResponse.json({ companyId: match[1] })
            }

            // Also check for data-warehouse-id or company-info div
            const match2 = html.match(/data-company-id="(\d+)"/)
            if (match2) {
                return NextResponse.json({ companyId: match2[1] })
            }

            return NextResponse.json({ error: 'Could not extract company ID' }, { status: 404 })

        } else {
            return NextResponse.json({ error: 'Invalid action. Use search, chart, or companyId' }, { status: 400 })
        }
    } catch (error: any) {
        console.error('Screener API error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
