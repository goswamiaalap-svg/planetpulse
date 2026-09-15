import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

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
    <html lang="en">
      <body className={`${inter.className} min-h-screen text-white relative overflow-x-hidden`}>
        {/* Full-viewport Cinematic Background Video matching PramaanCheck */}
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
          {/* Subtle cinematic vignette / dark contrast overlay */}
          <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
        </div>

        {/* Foreground Page Content */}
        <div className="relative z-10 min-h-screen flex flex-col">
          <Navbar />
          <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
