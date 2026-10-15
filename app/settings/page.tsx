'use client'

import { FormEvent, useEffect, useState } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function SettingsPage() {
  const [target, setTarget] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    fetch('/api/settings').then(async (response) => {
      if (!response.ok) throw new Error('Unable to load settings.')
      return response.json()
    }).then((data) => setTarget(data.weekly_target_kg == null ? '' : String(data.weekly_target_kg)))
      .catch((reason) => setMessage(reason instanceof Error ? reason.message : 'Unable to load settings.'))
      .finally(() => setLoading(false))
  }, [])
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('')
    try {
      const response = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weekly_target_kg: target === '' ? null : Number(target) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to save settings.')
      setTarget(data.weekly_target_kg == null ? '' : String(data.weekly_target_kg)); setMessage('Target saved.')
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to save settings.') }
    finally { setSaving(false) }
  }
  if (loading) return <LoadingSpinner message="Loading settings…" />
  return <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:pl-28 lg:pr-8">
    <header className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Preferences and data</p><h1 className="text-3xl font-semibold text-white sm:text-4xl">Settings & Privacy</h1><p className="mt-2 text-sm text-gray-400">Manage your weekly threshold and understand how this version handles your records.</p></header>
    <form onSubmit={save} className="card space-y-4"><div><h2 className="text-lg font-semibold text-white">Weekly footprint target</h2><p className="mt-1 text-sm text-gray-400">Set an optional target in kg CO₂ for the current weekly view.</p></div><label className="block text-sm text-gray-300">Target (kg CO₂)<input type="number" min="0.1" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} className="input mt-1 w-full sm:max-w-xs" placeholder="No target set" /></label><div className="flex items-center gap-3"><button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save target'}</button><button type="button" className="btn-secondary" onClick={() => setTarget('')}>Clear target</button>{message && <span role="status" className="text-sm text-gray-300">{message}</span>}</div></form>
    <section className="card mt-6 border-amber-400/20"><h2 className="text-lg font-semibold text-white">Privacy and account controls</h2><p className="mt-2 text-sm leading-6 text-gray-300">This deployment does not yet provide sign-in or account-scoped data controls. Activity and preference records are stored in the connected Supabase project, and this app cannot currently offer a per-user export or deletion control.</p><p className="mt-3 text-xs text-amber-200/80">Do not treat this build as a private multi-user account system. Authentication and row-level user isolation still need implementation.</p></section>
  </main>
}
