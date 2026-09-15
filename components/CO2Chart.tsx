'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { CATEGORY_COLORS, ActivityType, getTypeName } from '@/lib/co2'

export type CategoryTotal = {
  type: ActivityType
  co2_kg: number
}

type Props = {
  data: CategoryTotal[]
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name: string }> }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#101b17] border border-emerald-800/40 rounded-xl shadow-2xl p-3 text-sm">
        <p className="font-bold text-gray-200 mb-1">{payload[0].name}</p>
        <p className="text-emerald-400 font-mono font-semibold">{payload[0].value.toFixed(3)} kg CO₂</p>
      </div>
    )
  }
  return null
}

export default function CO2Chart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        No data to display
      </div>
    )
  }

  const chartData = data.map((d) => ({
    name: getTypeName(d.type),
    type: d.type,
    'CO₂ (kg)': d.co2_kg,
  }))

  return (
    <div>
      {/* Recharts BarChart */}
      <div className="h-64 w-full" role="img" aria-label="CO2 emissions by category bar chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
            barSize={36}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#162620" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'kg CO₂', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }} />
            <Bar dataKey="CO₂ (kg)" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CATEGORY_COLORS[entry.type as ActivityType]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Accessible table — exact numbers readable by browser agents */}
      <div className="mt-8">
        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">
          Category Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="CO2 emissions breakdown by category">
            <thead>
              <tr className="border-b border-emerald-950/60 text-gray-400">
                <th className="text-left py-2.5 font-semibold text-xs uppercase">Category</th>
                <th className="text-right py-2.5 font-semibold text-xs uppercase">CO₂ (kg)</th>
                <th className="text-right py-2.5 font-semibold text-xs uppercase">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/40">
              {data.map((row) => {
                const total = data.reduce((s, d) => s + d.co2_kg, 0)
                const pct = total > 0 ? ((row.co2_kg / total) * 100).toFixed(1) : '0.0'
                const color = CATEGORY_COLORS[row.type]
                return (
                  <tr
                    key={row.type}
                    className="hover:bg-emerald-950/20 transition-colors"
                    data-category={row.type}
                    data-co2-kg={row.co2_kg.toFixed(3)}
                  >
                    <td className="py-2.5 flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-gray-200">{getTypeName(row.type)}</span>
                    </td>
                    <td className="py-2.5 text-right font-mono font-medium text-gray-200" data-testid={`co2-${row.type}`}>
                      {row.co2_kg.toFixed(3)}
                    </td>
                    <td className="py-2.5 text-right text-gray-400 font-mono">{pct}%</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-emerald-900/60">
                <td className="py-3 font-bold text-gray-100">Total</td>
                <td className="py-3 text-right font-mono font-bold text-emerald-400 text-base" data-testid="co2-total">
                  {data.reduce((s, d) => s + d.co2_kg, 0).toFixed(3)}
                </td>
                <td className="py-3 text-right text-gray-400 font-mono font-medium">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
