'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ActivityType,
  EMISSION_FACTORS,
  ABSURD_THRESHOLDS,
  calculateCO2,
  getUnitLabel,
  getTypeName,
  CATEGORY_COLORS,
} from '@/lib/co2'
import { toISODateString } from '@/lib/week'

const ACTIVITY_TYPES: ActivityType[] = [
  'car', 'bus', 'flight', 'electricity', 'veg_meal', 'non_veg_meal',
]

type Props = {
  onSuccess?: () => void
}

export default function ActivityForm({ onSuccess }: Props) {
  const router = useRouter()
  const [type, setType] = useState<ActivityType>('car')
  const [quantity, setQuantity] = useState('')
  const [date, setDate] = useState(toISODateString(new Date()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(false)

  const unit = getUnitLabel(type)
  const quantityNum = parseFloat(quantity)
  const estimatedCO2 = !isNaN(quantityNum) && quantityNum > 0
    ? calculateCO2(type, quantityNum)
    : null

  const handleSubmit = async (e: React.FormEvent, confirmed = false) => {
    e?.preventDefault()
    setError(null)

    // Validate quantity
    if (!quantity || isNaN(quantityNum) || quantityNum <= 0) {
      setError('Please enter a quantity greater than 0.')
      return
    }

    // DP2: absurd input check
    const threshold = ABSURD_THRESHOLDS[type]
    if (!confirmed && quantityNum > threshold) {
      setShowWarning(true)
      setPendingSubmit(true)
      return
    }

    setLoading(true)
    try {
      const co2_kg = calculateCO2(type, quantityNum)
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, quantity: quantityNum, co2_kg, date }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save activity')
      }

      setSuccess(true)
      setQuantity('')
      setDate(toISODateString(new Date()))
      setShowWarning(false)
      setPendingSubmit(false)

      // Refresh dashboard data without full page reload
      router.refresh()
      onSuccess?.()

      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = (e: React.MouseEvent) => {
    setShowWarning(false)
    setPendingSubmit(false)
    handleSubmit(e as unknown as React.FormEvent, true)
  }

  return (
    <div className="card max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Log an Activity</h1>

      {success && (
        <div
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 mb-4 flex items-center gap-2"
          role="alert"
          data-testid="success-message"
        >
          <span>✅</span>
          <span>Activity logged successfully! Dashboard has been updated.</span>
        </div>
      )}

      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 mb-4"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* DP2: Absurd input warning */}
      {showWarning && (
        <div
          className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-4 mb-4"
          role="dialog"
          aria-modal="true"
          aria-label="Unusual entry warning"
          data-testid="absurd-warning"
        >
          <p className="font-semibold text-amber-800 mb-2">⚠️ Unusually large entry</p>
          <p className="text-amber-700 text-sm mb-4">
            {quantityNum.toLocaleString()} {unit} for a {getTypeName(type)} trip is much larger
            than typical. Are you sure you want to log this?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              className="btn-primary text-sm"
              data-testid="confirm-anyway"
            >
              Yes, log it anyway
            </button>
            <button
              type="button"
              onClick={() => { setShowWarning(false); setPendingSubmit(false) }}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Activity type */}
        <div className="mb-4">
          <label className="label" htmlFor="activity-type">Activity type</label>
          <select
            id="activity-type"
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as ActivityType)}
            aria-label="Select activity type"
            data-testid="type-select"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {getTypeName(t)}
              </option>
            ))}
          </select>
        </div>

        {/* Quantity */}
        <div className="mb-4">
          <label className="label" htmlFor="quantity">
            Quantity ({unit})
          </label>
          <div className="relative">
            <input
              id="quantity"
              type="number"
              className="input pr-16"
              placeholder={`Enter ${unit}`}
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              aria-label={`Quantity in ${unit}`}
              data-testid="quantity-input"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
              {unit}
            </span>
          </div>
        </div>

        {/* Date */}
        <div className="mb-6">
          <label className="label" htmlFor="activity-date">Date</label>
          <input
            id="activity-date"
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={toISODateString(new Date())}
            required
            data-testid="date-input"
          />
        </div>

        {/* CO2 preview */}
        {estimatedCO2 !== null && (
          <div
            className="mb-5 flex items-center gap-3 px-4 py-3 rounded-lg text-sm"
            style={{
              backgroundColor: `${CATEGORY_COLORS[type]}15`,
              border: `1px solid ${CATEGORY_COLORS[type]}30`,
            }}
            data-testid="co2-preview"
          >
            <span className="text-lg">🌿</span>
            <span>
              Estimated:{' '}
              <strong style={{ color: CATEGORY_COLORS[type] }}>
                {estimatedCO2} kg CO₂
              </strong>
            </span>
          </div>
        )}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading}
          data-testid="submit-button"
        >
          {loading ? 'Saving…' : 'Log Activity'}
        </button>
      </form>
    </div>
  )
}
