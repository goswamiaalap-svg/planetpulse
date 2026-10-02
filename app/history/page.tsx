import { Suspense } from 'react'
import HistoryClient from './HistoryClient'
import LoadingSpinner from '@/components/LoadingSpinner'

export const metadata = {
  title: 'History — PlanetPulse',
}

export default function HistoryPage() {
  return (
    <div className="w-full px-4 sm:px-6 lg:pl-24 lg:pr-8 py-8">
      <Suspense fallback={<LoadingSpinner message="Loading history…" />}>
        <HistoryClient />
      </Suspense>
    </div>
  )
}
