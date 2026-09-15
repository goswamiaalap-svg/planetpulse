'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/', label: '🌍 Dashboard' },
  { href: '/log', label: '+ Log Activity' },
  { href: '/history', label: '📋 History' },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🌱</span>
            <span className="text-xl font-bold text-emerald-700 tracking-tight">PlanetPulse</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-100'
                } ${link.href === '/log' ? 'bg-emerald-600 text-white hover:bg-emerald-700 ml-2' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}
