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
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-800">{payload[0].name}</p>
        <p className="text-gray-600">{payload[0].value.toFixed(3)} kg CO₂</p>
      </div>
    )
  }
  return null
}

export default function CO2Chart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
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
      {/* Recharts BarChart — visual rendering */}
      <div className="h-64 w-full" role="img" aria-label="CO2 emissions by category bar chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            barSize={40}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'kg CO₂', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }}
            />
            <Tooltip content={<CustomTooltip />} />
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
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Category Breakdown
        </h3>
        <table className="w-full text-sm" aria-label="CO2 emissions breakdown by category">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 font-medium text-gray-600">Category</th>
              <th className="text-right py-2 font-medium text-gray-600">CO₂ (kg)</th>
              <th className="text-right py-2 font-medium text-gray-600">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const total = data.reduce((s, d) => s + d.co2_kg, 0)
              const pct = total > 0 ? ((row.co2_kg / total) * 100).toFixed(1) : '0.0'
              const color = CATEGORY_COLORS[row.type]
              return (
                <tr
                  key={row.type}
                  className="border-b border-gray-50 hover:bg-gray-50"
                  data-category={row.type}
                  data-co2-kg={row.co2_kg.toFixed(3)}
                >
                  <td className="py-2.5 flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span>{getTypeName(row.type)}</span>
                  </td>
                  <td className="py-2.5 text-right font-mono font-medium" data-testid={`co2-${row.type}`}>
                    {row.co2_kg.toFixed(3)}
                  </td>
                  <td className="py-2.5 text-right text-gray-500">{pct}%</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200">
              <td className="py-2.5 font-semibold">Total</td>
              <td className="py-2.5 text-right font-mono font-bold" data-testid="co2-total">
                {data.reduce((s, d) => s + d.co2_kg, 0).toFixed(3)}
              </td>
              <td className="py-2.5 text-right text-gray-500">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
