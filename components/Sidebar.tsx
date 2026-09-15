'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const sidebarLinks = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/log', label: 'Log Activity', icon: '✍️' },
  { href: '/history', label: 'History Gazette', icon: '📜' },
  { href: '/#ai-coach', label: 'AI Carbon Coach', icon: '🤖' },
  { href: '/#set-target', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 bg-[#0c1015]/80 backdrop-blur-xl border-r border-white/10 p-6 flex-shrink-0 z-50">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-10 group">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl border border-emerald-500/30 group-hover:scale-110 transition-transform">
          🌱
        </div>
        <span className="font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-white text-lg">
          PlanetPulse
        </span>
      </Link>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-2">
        {sidebarLinks.map((link) => {
          // Exact match for active state unless it's a hash link, which we won't strictly mark as active here to avoid hydration mismatches, but we can do simple matching.
          const isActive = pathname === link.href || pathname === link.href.split('#')[0] && link.href !== '/'

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                isActive && !link.href.includes('#')
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <span className="text-lg">{link.icon}</span>
              <span className="text-sm tracking-wide">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Quick Action Bottom */}
      <div className="mt-auto">
        <Link
          href="/log"
          className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl py-3 flex items-center justify-center gap-2 transition-all hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] font-bold text-sm"
        >
          <span>+</span>
          <span>New Entry</span>
        </Link>
      </div>
    </aside>
  )
}
