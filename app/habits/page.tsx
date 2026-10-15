'use client'

import { FormEvent, useEffect, useState } from 'react'
import { ActivityType, getTypeName } from '@/lib/co2'
import { HabitGoal } from '@/lib/supabase'
import LoadingSpinner from '@/components/LoadingSpinner'

const categories: ActivityType[] = ['car', 'bus', 'flight', 'electricity', 'veg_meal', 'non_veg_meal']

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [action, setAction] = useState('')
  const [category, setCategory] = useState<ActivityType>('bus')
  const [goalCount, setGoalCount] = useState('3')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setError('')
    try {
      const response = await fetch('/api/habits')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load goals.')
      setHabits(data.habits || [])
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load goals.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const createGoal = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/habits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, category, target_action: action, weekly_goal_count: Number(goalCount) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to save goal.')
      setHabits((current) => [data.habit, ...current])
      setTitle(''); setAction('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save goal.') }
    finally { setSaving(false) }
  }

  const complete = async (id: string) => {
    try {
      const response = await fetch('/api/habits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, increment: true }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to update progress.')
      setHabits((current) => current.map((habit) => habit.id === id ? data.habit : habit))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update progress.') }
  }

  if (loading) return <LoadingSpinner message="Loading your goals…" />
  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:pl-28 lg:pr-8">
    <header className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Small, chosen actions</p><h1 className="text-3xl font-semibold text-white sm:text-4xl">Habits & Goals</h1><p className="mt-2 text-sm text-gray-400">Track action completion separately from estimated emissions.</p></header>
    {error && <div role="alert" className="mb-5 rounded-xl border border-rose-400/30 bg-rose-950/30 p-4 text-sm text-rose-200">{error} {error.includes('load') && <button onClick={() => void load()} className="ml-2 underline">Retry</button>}</div>}
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-4">
        {habits.length === 0 ? <div className="card py-10 text-center"><h2 className="text-lg font-semibold text-white">No goals saved yet</h2><p className="mt-2 text-sm text-gray-400">Create one small action that fits your routine.</p></div> : habits.map((habit) => <article key={habit.id} className="card"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-emerald-300">{getTypeName(habit.category)}</p><h2 className="mt-1 text-lg font-semibold text-white">{habit.title}</h2><p className="mt-1 text-sm text-gray-400">{habit.target_action}</p></div><button onClick={() => void complete(habit.id)} className="btn-secondary">Mark done</button></div><div className="mt-5"><div className="mb-2 flex justify-between text-xs text-gray-400"><span>Weekly actions</span><span>{habit.completed_count} / {habit.weekly_goal_count}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, habit.weekly_goal_count ? habit.completed_count / habit.weekly_goal_count * 100 : 0)}%` }} /></div></div></article>)}
      </section>
      <form onSubmit={createGoal} className="card h-fit space-y-4"><div><h2 className="text-lg font-semibold text-white">Create a weekly goal</h2><p className="mt-1 text-sm text-gray-400">Choose an action you want to try.</p></div><label className="block text-sm text-gray-300">Goal name<input required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1 w-full" placeholder="e.g. Take the bus to work" /></label><label className="block text-sm text-gray-300">Action<input required maxLength={240} value={action} onChange={(e) => setAction(e.target.value)} className="input mt-1 w-full" placeholder="What will you do?" /></label><label className="block text-sm text-gray-300">Related category<select value={category} onChange={(e) => setCategory(e.target.value as ActivityType)} className="input mt-1 w-full">{categories.map((item) => <option key={item} value={item}>{getTypeName(item)}</option>)}</select></label><label className="block text-sm text-gray-300">Times per week<input required type="number" min="1" max="14" value={goalCount} onChange={(e) => setGoalCount(e.target.value)} className="input mt-1 w-full" /></label><button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save goal'}</button><p className="text-xs text-gray-500">Completing a goal records the action only; it does not claim a calculated emissions reduction.</p></form>
    </div>
  </main>
}
