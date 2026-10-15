import AICarbonCoach from '@/components/AICarbonCoach'

export const metadata = { title: 'AI Sustainability Coach — PlanetPulse' }

export default function CoachPage() {
  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:pl-28 lg:pr-8">
    <header className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Ask about your data</p><h1 className="text-3xl font-semibold text-white sm:text-4xl">AI Sustainability Coach</h1><p className="mt-2 text-sm text-gray-400">Ask a question, explore a scenario, and see when an answer is based on your records or general evidence.</p></header>
    <AICarbonCoach />
  </main>
}
