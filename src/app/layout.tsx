import type { Metadata } from 'next'
import { ReactNode } from 'react'
import './globals.css'

// Auto-start scheduler on server startup
if (typeof window === 'undefined') {
  import('@/lib/scheduler')
}

export const metadata: Metadata = {
  title: 'Gloria Price Validation System',
  description: 'Automated price validation and stock control system for hotel group'
}

export default function RootLayout({
  children
}: {
  children: ReactNode
}) {
  return (
    <html lang="tr">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
} 