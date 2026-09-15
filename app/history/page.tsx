import { Suspense } from 'react'
import HistoryClient from './HistoryClient'
import LoadingSpinner from '@/components/LoadingSpinner'

export const metadata = {
  title: 'History — PlanetPulse',
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading history…" />}>
      <HistoryClient />
    </Suspense>
  )
}
