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
  onPositionChange?: (index: number) => void;
}

export default function ElevationChart({ elevations, totalDistance, onPositionChange }: ElevationChartProps) {
  if (elevations.length < 2) return null;

  const handleTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!onPositionChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.floor(ratio * (elevations.length - 1));
    onPositionChange(index);
  };

  const data = elevations.map((elev, i) => ({
    dist: parseFloat(((i / (elevations.length - 1)) * totalDistance / 1000).toFixed(2)),
    elev: Math.round(elev),
  }));

  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const yMin = Math.floor(minElev / 10) * 10;
  const yMax = Math.ceil(maxElev / 10) * 10;

  return (
    <div className="mt-2 mb-1">
      {/* Chart */}
      <div
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        style={{ touchAction: 'none' }}
      >
      <ResponsiveContainer width="100%" height={60}>
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
    </div>
  );
}
