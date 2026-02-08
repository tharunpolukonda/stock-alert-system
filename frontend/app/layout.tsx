import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Stock Alert System',
  description: 'Real-time stock monitoring and alerts',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={cn(inter.className, "min-h-screen bg-black text-white antialiased selection:bg-blue-500/30")}>
        <div className="fixed inset-0 -z-10 h-full w-full bg-black">
          <div className="absolute top-0 z-[0] h-screen w-screen bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
        </div>
        {children}
      </body>
    </html>
  )
}
