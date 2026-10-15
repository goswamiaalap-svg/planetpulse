'use client'

import { FormEvent, KeyboardEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActivityType, getTypeName } from '@/lib/co2'
import type { BatchEntryResult } from '@/lib/activityLogging'

type Receipt = {
  results: BatchEntryResult[]
  summary: { week_total_kg: number; target_kg: number | null; percent_of_target: number | null }
  summaryLine: string
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  receipt?: Receipt
  undone?: string[]
}

type Pending = { type: ActivityType; quantity: number; date: string; confirm_token: string }

function confirmationChoice(message: string): 'yes' | 'no' | null {
  const clean = message.trim().toLowerCase().replace(/[.!?]+$/, '')
  if (/^(yes|yep|yeah|correct|confirm|confirmed|sure|that's right|do it)(\b|\s)/.test(`${clean} `)) return 'yes'
  if (/^(no|nope|incorrect|cancel|don't|do not)(\b|\s)/.test(`${clean} `)) return 'no'
  return null
}

function StatusChip({ result }: { result: BatchEntryResult }) {
  if (result.status === 'logged') return <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300">Logged</span>
  if (result.status === 'needs_confirmation') return <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-200">Needs confirmation</span>
  if (result.status === 'ignored') return <span className="rounded-full bg-gray-500/15 px-2 py-1 text-[10px] font-semibold text-gray-300">Ignored duplicate</span>
  return <span className="rounded-full bg-rose-500/15 px-2 py-1 text-[10px] font-semibold text-rose-300">Rejected: {result.reason}</span>
}

export default function AICarbonLogger() {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [loading, setLoading] = useState(false)
  const [undoing, setUndoing] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const send = async (event?: FormEvent) => {
    event?.preventDefault()
    const text = message.trim()
    if (!text || loading) return
    setError(null)
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text }])
    setMessage('')

    if (pending.length && confirmationChoice(text) === 'no') {
      setPending([])
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: 'Okay, I left those entries unlogged.' }])
      return
    }

    setLoading(true)
    try {
      const shouldConfirm = pending.length > 0 && confirmationChoice(text) === 'yes'
      const response = await fetch('/api/ai/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, ...(shouldConfirm ? { pending_confirmations: pending } : {}) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not log activities')

      const results = (data.results || []) as BatchEntryResult[]
      const nextPending = results.filter((result: BatchEntryResult): result is Extract<BatchEntryResult, { status: 'needs_confirmation' }> => result.status === 'needs_confirmation')
        .map((result) => ({ type: result.type, quantity: result.quantity, date: result.date, confirm_token: result.confirm_token }))
      setPending(nextPending)
      const receipt = results.length ? { results, summary: data.summary, summaryLine: data.summary_line || '' } : undefined
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: receipt ? (data.follow_up || '') : data.message, receipt }])
      if (results.some((result) => result.status === 'logged')) {
        window.dispatchEvent(new Event('planetpulse:activities-updated'))
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log activities')
    } finally {
      setLoading(false)
    }
  }

  const undo = async (messageId: string, ids: string[]) => {
    const pendingIds = ids.filter((id) => !undoing.includes(id))
    if (!pendingIds.length) return
    setUndoing((current) => [...current, ...pendingIds])
    try {
      const responses = await Promise.all(pendingIds.map(async (id) => ({
        id,
        response: await fetch(`/api/activities?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
      })))
      const deleted = responses.filter(({ response }) => response.ok).map(({ id }) => id)
      if (deleted.length) {
        setMessages((current) => current.map((item) => item.id === messageId
          ? { ...item, undone: Array.from(new Set([...(item.undone || []), ...deleted])) }
          : item))
        window.dispatchEvent(new Event('planetpulse:activities-updated'))
        router.refresh()
      }
      const failure = responses.find(({ response }) => !response.ok)
      if (failure) {
        const data = await failure.response.json().catch(() => ({}))
        throw new Error(data.error || 'Could not undo one or more activities')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not undo activities')
    } finally {
      setUndoing((current) => current.filter((id) => !pendingIds.includes(id)))
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <section className="card space-y-4 border-emerald-500/25" aria-labelledby="ai-log-title" data-testid="ai-activity-logger">
      <div>
        <h2 id="ai-log-title" className="text-xl font-bold text-white">Log with AI</h2>
        <p className="mt-1 text-sm text-gray-400">Describe several activities at once, including their dates. You can review and undo each entry.</p>
      </div>

      {messages.length > 0 && (
        <div className="max-h-[32rem] space-y-3 overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-3" aria-live="polite">
          {messages.map((item) => (
            <div key={item.id} className={`space-y-2 ${item.role === 'user' ? 'ml-8 text-right' : 'mr-2'}`}>
              <div className={`inline-block max-w-full rounded-xl px-3 py-2 text-left text-sm ${item.role === 'user' ? 'bg-emerald-900/50 text-emerald-100' : 'bg-white/5 text-gray-200'}`}>
                {item.text}
              </div>
              {item.receipt && (
                <div className="rounded-xl border border-emerald-900/50 bg-[#0c1511] p-3 text-left" data-testid="activity-receipt">
                  <div className="space-y-2">
                    {item.receipt.results.map((result, index) => {
                      const undone = result.status === 'logged' && item.undone?.includes(result.id)
                      return (
                        <div key={`${item.id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-semibold ${undone ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                              {result.type && Object.prototype.hasOwnProperty.call({ car: 1, bus: 1, flight: 1, electricity: 1, veg_meal: 1, non_veg_meal: 1 }, result.type)
                                ? getTypeName(result.type as ActivityType)
                                : 'Activity'}
                              {'quantity' in result && result.quantity !== undefined && ` · ${result.quantity}${'unit' in result ? ` ${result.unit}` : ''}`}
                              {result.status === 'logged' && ` · ${result.co2_kg.toFixed(2)} kg CO2`}
                              {result.status === 'needs_confirmation' && ` · ${result.co2_kg.toFixed(2)} kg CO2`}
                              {'date' in result && result.date && ` · ${result.date}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusChip result={result} />
                            {result.status === 'logged' && !undone && (
                              <button
                                type="button"
                                className="text-[10px] font-semibold text-gray-400 underline hover:text-rose-300 disabled:opacity-50"
                                onClick={() => void undo(item.id, [result.id])}
                                disabled={undoing.includes(result.id)}
                                aria-label={`Undo ${getTypeName(result.type)}`}
                              >Undo</button>
                            )}
                            {undone && <span className="text-[10px] text-gray-500">Undone</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {item.receipt.results.some((result) => result.status === 'logged') && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
                      <p className="text-xs text-emerald-200">{item.receipt.summaryLine}</p>
                      {(() => {
                        const remainingIds = item.receipt!.results
                          .filter((result): result is Extract<BatchEntryResult, { status: 'logged' }> => result.status === 'logged' && !item.undone?.includes(result.id))
                          .map((result) => result.id)
                        return remainingIds.length > 0 ? (
                          <button
                            type="button"
                            className="text-[10px] font-semibold text-rose-300 underline hover:text-rose-200 disabled:opacity-50"
                            onClick={() => void undo(item.id, remainingIds)}
                            disabled={remainingIds.some((id) => undoing.includes(id))}
                          >Undo all</button>
                        ) : null
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pending.length > 0 && <p className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">Reply “yes” to confirm the unusually large entries, or “no” to leave them unlogged.</p>}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}

      <form onSubmit={(event) => void send(event)} className="space-y-2">
        <label className="sr-only" htmlFor="ai-activity-message">Describe your activities</label>
        <textarea
          id="ai-activity-message"
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={2000}
          placeholder="For example: Drove 12 km, bus 8 km, veg lunch, non-veg dinner"
          className="input min-h-20 w-full resize-y"
          disabled={loading}
          data-testid="ai-activity-input"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-500">Enter to send · Shift + Enter for a new line</p>
          <button type="submit" className="btn-primary px-5 py-2 text-sm" disabled={loading || !message.trim()}>
            {loading ? 'Reviewing…' : 'Log activities'}
          </button>
        </div>
      </form>
    </section>
  )
}
