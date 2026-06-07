'use client';

import { useEffect, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

interface ElevationChartProps {
  elevations: number[];
  totalDistance: number; // meters
  onPositionChange?: (index: number) => void;
  currentIndex?: number;
  rideDistance?: number; // meters
}

export default function ElevationChart({ elevations, totalDistance, onPositionChange, currentIndex, rideDistance }: ElevationChartProps) {
  const lineId = useRef(`elevation-line-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const ratio = (totalDistance && totalDistance > 0 && rideDistance)
      ? Math.min(rideDistance / totalDistance, 1)
      : 0;
    const lineEl = document.getElementById(lineId.current);
    if (lineEl) {
      lineEl.setAttribute('x1', `${ratio * 100}%`);
      lineEl.setAttribute('x2', `${ratio * 100}%`);
    }
  }, [rideDistance, totalDistance]);

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
        style={{ position: 'relative', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
      >
        {/* 現在位置インジケーター（走行中・DOM直接操作） */}
        {rideDistance != null && (
          <svg
            style={{ position: 'absolute', top: 0, left: 16, right: 4, height: '100%', width: 'calc(100% - 20px)', pointerEvents: 'none', zIndex: 10 }}
          >
            <line
              id={lineId.current}
              x1="0%" y1="0" x2="0%" y2="100%"
              stroke="#D4AF37"
              strokeWidth={2}
              strokeDasharray="4,2"
            />
          </svg>
        )}
        <ResponsiveContainer width="100%" height={72}>
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
            {currentIndex != null && (
              <ReferenceLine
                x={data[Math.min(currentIndex, data.length - 1)]?.dist}
                stroke="#D4AF37"
                strokeWidth={2}
                strokeDasharray="4 2"
                label={{
                  value: `${Math.round(elevations[Math.min(currentIndex, elevations.length - 1)])}m`,
                  fill: '#D4AF37',
                  fontSize: 11,
                  fontWeight: 'bold',
                  position: 'top',
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
