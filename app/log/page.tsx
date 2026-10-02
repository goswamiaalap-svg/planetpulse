import ActivityForm from '@/components/ActivityForm'

export const metadata = {
  title: 'Log Activity — PlanetPulse',
}

export default function LogPage() {
  return (
    <div className="w-full px-4 sm:px-6 lg:pl-24 lg:pr-8 py-8">
      <ActivityForm />
    </div>
  )
}
