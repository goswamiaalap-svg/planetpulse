import type { Metadata } from 'next'
import { Inter, Instrument_Serif } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'PlanetPulse — Track Your Carbon Footprint',
  description: 'Log activities, visualize your weekly CO2 footprint, set targets, and get AI-powered nudges to live more sustainably.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body className={`${inter.className} font-sans min-h-screen text-white relative overflow-x-hidden bg-[#050706]`}>
        {/* Full-viewport Cinematic Background Video — ambient dark layer for non-hero pages */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
              type="video/mp4"
            />
          </video>
          {/* Dark overlay for non-hero pages */}
          <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
        </div>

        {/* Fixed Sidebar — overlays content, does NOT compress layout */}
        <Sidebar />

        {/* Full-width page content — no flex row with sidebar */}
        <div className="relative z-10 min-h-screen flex flex-col">
          <div className="lg:hidden">
            <Navbar />
          </div>
          <main className="flex-1 w-full">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
