'use client'

import { CATEGORY_COLORS, ActivityType, getTypeName } from '@/lib/co2'

type Props = {
  type: ActivityType
  size?: 'sm' | 'md'
}

export default function CategoryBadge({ type, size = 'md' }: Props) {
  const color = CATEGORY_COLORS[type]
  const name = getTypeName(type)

  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClass}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      {getCategoryIcon(type)} &nbsp;{name}
    </span>
  )
}

function getCategoryIcon(type: ActivityType): string {
  switch (type) {
    case 'car': return '🚗'
    case 'bus': return '🚌'
    case 'flight': return '✈️'
    case 'electricity': return '⚡'
    case 'veg_meal': return '🥗'
    case 'non_veg_meal': return '🍖'
  }
}
