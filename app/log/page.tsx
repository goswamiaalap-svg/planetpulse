import ActivityForm from '@/components/ActivityForm'

export const metadata = {
  title: 'Log Activity — PlanetPulse',
}

export default function LogPage() {
  return (
    <div className="py-4">
      <ActivityForm />
    </div>
  )
}
