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

  const unit = getUnitLabel(type)
  const quantityNum = parseFloat(quantity)
  const estimatedCO2 = !isNaN(quantityNum) && quantityNum > 0
    ? calculateCO2(type, quantityNum)
    : null

  const handleSubmit = async (e?: React.FormEvent, confirmed = false) => {
    e?.preventDefault()
    setError(null)

    // Validate quantity
    if (!quantity || isNaN(quantityNum) || quantityNum <= 0) {
      setError('Please enter a quantity greater than 0.')
      return
    }

    // DP2: absurd input check per-type ceiling
    const threshold = ABSURD_THRESHOLDS[type]
    if (!confirmed && quantityNum > threshold) {
      setShowWarning(true)
      return
    }

    setLoading(true)
    try {
      const co2_kg = calculateCO2(type, quantityNum)
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, quantity: quantityNum, co2_kg, date, confirmed: true }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save activity')
      }

      setSuccess(true)
      setQuantity('')
      setDate(toISODateString(new Date()))
      setShowWarning(false)

      router.refresh()
      onSuccess?.()

      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    setShowWarning(false)
    handleSubmit(undefined, true)
  }

  const handleCancel = () => {
    setShowWarning(false)
  }

  return (
    <div className="card max-w-lg mx-auto border-emerald-900/40">
      <h1 className="text-2xl font-black text-gray-100 mb-6 tracking-tight">Log an Activity</h1>

      {success && (
        <div
          className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-sm flex items-center gap-2.5"
          data-testid="success-message"
        >
          <span className="text-lg">✅</span>
          <span className="font-medium">Activity logged successfully!</span>
        </div>
      )}

      {error && (
        <div
          className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-sm flex items-center gap-2.5"
          data-testid="form-error"
        >
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5" noValidate>
        {/* Activity Type Selection */}
        <div>
          <label className="label">Activity Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {ACTIVITY_TYPES.map((t) => {
              const isSelected = type === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t)
                    setShowWarning(false)
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-left transition-all border flex items-center gap-2 ${
                    isSelected
                      ? 'bg-[#182923] border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/40'
                      : 'bg-[#0d1613] border-emerald-950/60 text-gray-400 hover:border-emerald-800/60 hover:text-gray-200'
                  }`}
                  data-testid={`type-select-${t}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[t] }}
                  />
                  <span className="truncate">{getTypeName(t)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Quantity Input */}
        <div>
          <label htmlFor="quantity" className="label">
            Quantity ({unit})
          </label>
          <div className="relative">
            <input
              id="quantity"
              type="number"
              min="0.01"
              step="any"
              placeholder={`Enter ${unit}`}
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value)
                setShowWarning(false)
              }}
              className="input pr-16 font-mono"
              required
              data-testid="quantity-input"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold uppercase">
              {unit}
            </span>
          </div>
        </div>

        {/* Real-time CO2 Preview */}
        {estimatedCO2 !== null && (
          <div className="p-3.5 bg-[#0e1915] border border-emerald-900/40 rounded-xl flex items-center justify-between text-sm">
            <span className="text-gray-400 font-medium">Estimated CO₂:</span>
            <span className="font-mono font-bold text-emerald-400 text-base" data-testid="co2-preview">
              {estimatedCO2.toFixed(3)} kg
            </span>
          </div>
        )}

        {/* Date Input */}
        <div>
          <label htmlFor="date" className="label">Date</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input font-mono"
            required
            data-testid="date-input"
          />
        </div>

        {/* DP2: Inline Absurd Input Confirmation Warning */}
        {showWarning && (
          <div
            className="p-4 bg-amber-950/40 border-2 border-amber-500/60 rounded-xl space-y-3 animate-in fade-in zoom-in-95 duration-200"
            data-testid="absurd-warning-dialog"
            role="alert"
          >
            <div className="flex items-start gap-2.5">
              <span className="text-xl flex-shrink-0">⚠️</span>
              <div>
                <p className="text-amber-300 font-semibold text-sm leading-snug" data-testid="warning-text">
                  That&apos;s an unusually large entry — are you sure this is correct?
                </p>
                <p className="text-amber-400/80 text-xs mt-1">
                  You entered <strong className="font-mono text-white">{quantity} {unit}</strong> for {getTypeName(type)} ({calculateCO2(type, quantityNum).toFixed(1)} kg CO₂). Standard threshold is {ABSURD_THRESHOLDS[type]} {unit}.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-1.5 rounded-lg border border-amber-500/30 text-amber-200 hover:bg-amber-900/40 text-xs font-semibold transition-all"
                data-testid="warning-cancel"
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-bold transition-all shadow-md"
                data-testid="warning-confirm"
                aria-label="Confirm"
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3"
          data-testid="submit-activity"
        >
          {loading ? 'Logging…' : 'Log Activity'}
        </button>
      </form>
    </div>
  )
}
