'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ElevationChartProps {
  elevations: number[];
  totalDistance: number; // meters
}

export default function ElevationChart({ elevations, totalDistance }: ElevationChartProps) {
  if (elevations.length < 2) return null;

  const data = elevations.map((elev, i) => ({
    dist: parseFloat(((i / (elevations.length - 1)) * totalDistance / 1000).toFixed(2)),
    elev: Math.round(elev),
  }));

  const maxElev = Math.max(...elevations);
  const minElev = Math.min(...elevations);

  let gain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) gain += diff;
  }

  const yMin = Math.floor(minElev / 10) * 10;
  const yMax = Math.ceil(maxElev / 10) * 10;

  return (
    <div className="mt-2 mb-1">
      {/* Stats */}
      <div className="flex justify-around text-xs text-[var(--text-muted)] mb-1.5">
        <span>↑ 最高 <span className="text-[var(--text)] font-semibold">{Math.round(maxElev)}m</span></span>
        <span>↓ 最低 <span className="text-[var(--text)] font-semibold">{Math.round(minElev)}m</span></span>
        <span>▲ 獲得 <span className="text-[var(--text)] font-semibold">{Math.round(gain)}m</span></span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="dist"
            tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
            tickFormatter={(v) => `${v}km`}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
            tickFormatter={(v) => `${v}`}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '11px',
              padding: '4px 8px',
            }}
            formatter={(value) => [`${value}m`, '標高']}
            labelFormatter={(label) => `${label}km`}
          />
          <Area
            type="monotone"
            dataKey="elev"
            stroke="#D4AF37"
            strokeWidth={1.5}
            fill="url(#elevGradient)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
