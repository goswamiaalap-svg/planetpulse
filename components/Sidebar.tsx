'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, PenLine, ScrollText, Bot, Settings, Plus, Menu, X, Leaf } from 'lucide-react'

const sidebarLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/log', label: 'Log Activity', icon: PenLine },
  { href: '/history', label: 'History Gazette', icon: ScrollText },
  { href: '/#ai-coach', label: 'AI Carbon Coach', icon: Bot },
  { href: '/#set-target', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <aside 
      className={`hidden lg:flex flex-col h-screen fixed top-0 left-0 bg-[#090d16]/40 backdrop-blur-2xl border-r border-white/15 p-4 z-[60] transition-all duration-300 shadow-[10px_0_30px_rgba(0,0,0,0.2)] ${
        isOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Toggle Button & Logo */}
      <div className={`flex items-center mb-10 mt-2 ${isOpen ? 'justify-between' : 'justify-center'}`}>
        {isOpen && (
          <Link href="/" className="flex items-center group overflow-hidden pl-2">
            <span className="font-display text-xl text-white whitespace-nowrap group-hover:scale-105 transition-transform origin-left tracking-tight">
              PlanetPulse<sup className="text-[8px] font-sans font-normal text-white/40 ml-0.5">®</sup>
            </span>
          </Link>
        )}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
          aria-label="Toggle Sidebar"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-2 overflow-hidden">
        {sidebarLinks.map((link) => {
          const isActive = pathname === link.href || (pathname === link.href.split('#')[0] && link.href !== '/')

          return (
            <Link
              key={link.href}
              href={link.href}
              title={!isOpen ? link.label : undefined}
              className={`flex items-center gap-3 py-3 rounded-xl transition-all duration-300 whitespace-nowrap ${
                isOpen ? 'px-4' : 'justify-center px-0'
              } ${
                isActive && !link.href.includes('#')
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold shadow-[0_0_20px_rgba(16,185,129,0.2)] backdrop-blur-md'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white border border-transparent'
              }`}
            >
              <link.icon className={`w-5 h-5 flex-shrink-0 ${isActive && !link.href.includes('#') ? 'text-emerald-400' : ''}`} />
              {isOpen && <span className="text-sm tracking-wide">{link.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Quick Action Bottom */}
      <div className="mt-auto overflow-hidden flex flex-col items-center gap-6">
        <Link
          href="/log"
          title={!isOpen ? "New Entry" : undefined}
          className={`w-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 rounded-xl py-3 flex items-center gap-2 transition-all hover:-translate-y-0.5 font-bold text-sm whitespace-nowrap backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.15)] ${
            isOpen ? 'justify-center px-4' : 'justify-center px-0'
          }`}
        >
          <Plus className="w-5 h-5 flex-shrink-0" />
          {isOpen && <span>New Entry</span>}
        </Link>
        
        {/* Permanent Bottom Logo */}
        <Link href="/" className="block opacity-80 hover:opacity-100 transition-opacity pb-2">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg overflow-hidden">
            <img src="/logo.png" alt="PlanetPulse" className="w-7 h-7 object-contain" />
          </div>
        </Link>
      </div>
    </aside>
  )
}
