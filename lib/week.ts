// lib/week.ts — ISO week utilities (DP3: weeks start Monday)

/**
 * Get the Monday of the week containing the given date.
 * ISO 8601: weeks start on Monday.
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  // Convert Sunday (0) to 7 so Monday=1 is the start
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get the Sunday (end) of the week containing the given date.
 */
export function getWeekEnd(date: Date = new Date()): Date {
  const start = getWeekStart(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

/**
 * Get the current week's date range as ISO strings.
 */
export function getWeekRange(date: Date = new Date()): { from: string; to: string } {
  const start = getWeekStart(date)
  const end = getWeekEnd(date)
  return {
    from: toISODateString(start),
    to: toISODateString(end),
  }
}

/**
 * Convert a Date to a YYYY-MM-DD string in local time.
 */
export function toISODateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type WeekProgress = {
  dayOfWeek: number      // 1=Mon ... 7=Sun
  totalDays: 7
  elapsedDays: number    // days completed (0-6)
  elapsedPct: number     // 0-100
  weekStart: string      // YYYY-MM-DD
  weekEnd: string        // YYYY-MM-DD
}

/**
 * Get elapsed-time-aware week progress (DP3).
 * "Day 3 of 7 — 43% of week elapsed"
 */
export function getWeekProgress(now: Date = new Date()): WeekProgress {
  const start = getWeekStart(now)
  const end = getWeekEnd(now)

  // Day of week: Mon=1, Tue=2, ..., Sun=7
  const jsDay = now.getDay() // 0=Sun
  const dayOfWeek = jsDay === 0 ? 7 : jsDay

  // How many full days have elapsed since Monday 00:00
  const msElapsed = now.getTime() - start.getTime()
  const daysElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24))
  const elapsedPct = Math.round(((daysElapsed + 1) / 7) * 100)

  return {
    dayOfWeek,
    totalDays: 7,
    elapsedDays: daysElapsed,
    elapsedPct: Math.min(elapsedPct, 100),
    weekStart: toISODateString(start),
    weekEnd: toISODateString(end),
  }
}

/**
 * Format a week-progress description string.
 * e.g. "Day 3 of 7 — 43% of week elapsed"
 */
export function formatWeekProgressLabel(wp: WeekProgress): string {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayName = dayNames[wp.dayOfWeek - 1]
  return `${dayName} — Day ${wp.dayOfWeek} of 7 · ${wp.elapsedPct}% of week elapsed`
}
