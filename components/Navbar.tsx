'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const navLinks = [
  { href: '/', label: 'Overview' },
  { href: '/footprint', label: 'Footprint' },
  { href: '/coach', label: 'AI Coach' },
  { href: '/habits', label: 'Habits' },
  { href: '/insights', label: 'Insights' },
  { href: '/settings', label: 'Settings' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="relative z-50 w-full">
      <div className="max-w-[1280px] mx-auto px-8 py-6 flex items-center justify-between">
        {/* Left — Wordmark in Instrument Serif */}
        <Link
          href="/"
          className="flex items-center group"
          aria-label="PlanetPulse Home"
        >
          <span className="font-display text-[30px] text-white tracking-tight leading-none">
            PlanetPulse
            <sup className="text-[10px] font-sans font-normal text-white/50 ml-0.5 align-super">®</sup>
          </span>
        </Link>

        {/* Center — Navigation links (hidden on mobile) */}
        <nav className="hidden lg:flex items-center gap-5 xl:gap-7">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== '/' && pathname === link.href.split('#')[0])
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[14px] font-medium tracking-wide transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'text-white opacity-100'
                    : 'text-white/60 hover:text-white hover:opacity-100'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Right — Pill CTA */}
        <Link
          href="/log"
          className="btn-pill py-2.5 px-6 text-[14px] font-medium hidden sm:inline-flex"
        >
          Start Tracking
        </Link>

        {/* Mobile menu toggle */}
        <button
          className="lg:hidden p-2 text-white/60 hover:text-white transition-colors"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
          </svg>
        </button>
      </div>

      {/* Mobile Nav Dropdown */}
      <nav
        id="mobile-nav"
        className={`${menuOpen ? 'block' : 'hidden'} lg:hidden px-4 sm:px-8 pb-4 space-y-1`}
      >
        {navLinks.map((link) => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block py-2.5 px-4 rounded-xl text-[14px] font-medium transition-all ${
                isActive
                  ? 'text-white bg-white/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
        <Link
          href="/log"
          className="block mt-2 btn-pill py-2.5 px-6 text-[14px] font-medium text-center"
        >
          Start Tracking
        </Link>
      </nav>
    </header>
  )
}
