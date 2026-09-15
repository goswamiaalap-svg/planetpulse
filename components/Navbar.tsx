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
    <header className="bg-[#0e1714]/80 backdrop-blur-md border-b border-emerald-950/60 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl transition-transform group-hover:scale-110">🌱</span>
            <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200 tracking-tight">
              PlanetPulse
            </span>
          </Link>
          <nav className="flex items-center gap-1.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              const isLog = link.href === '/log'

              if (isLog) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="ml-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-gray-950 font-bold px-4 py-2 rounded-xl text-sm transition-all shadow-md shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {link.label}
                  </Link>
                )
              }

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#15231e]'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}
