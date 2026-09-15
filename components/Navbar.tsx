'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/log', label: 'Log Activity' },
  { href: '/history', label: 'History Gazette' },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full pt-4 pb-2">
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-between gap-4">
        {/* Circular Logo matching PramaanCheck */}
        <Link
          href="/"
          className="w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-xl flex-shrink-0 transition-transform hover:scale-105 active:scale-95"
          aria-label="PlanetPulse Home"
        >
          🌱
        </Link>

        {/* Floating White Pill Navigation */}
        <nav className="h-12 bg-white/95 backdrop-blur-md rounded-full px-5 flex items-center justify-center gap-6 shadow-xl flex-1 max-w-md border border-white/40">
          {navLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm tracking-tight transition-all font-medium ${
                  isActive
                    ? 'text-gray-950 font-bold opacity-100 scale-105'
                    : 'text-gray-700 opacity-60 hover:opacity-90'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Right CTA Button matching PramaanCheck Officer Login pill */}
        <Link
          href="/log"
          className="h-12 px-5 bg-[#28282a]/90 hover:bg-[#343436] text-[#c8c8c8] hover:text-white border border-white/10 rounded-full text-sm font-medium flex items-center justify-center shadow-lg transition-all hover:-translate-y-0.5 whitespace-nowrap flex-shrink-0"
        >
          + Log Entry
        </Link>
      </div>
    </header>
  )
}
