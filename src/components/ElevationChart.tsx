'use client';

import { useEffect, useRef, useState } from 'react';
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
  onPositionChange?: (index: number, distance: number, elevation: number) => void;
  rideDistance?: number;
}

export default function ElevationChart({ elevations, totalDistance, onPositionChange, rideDistance }: ElevationChartProps) {
  const gradientId = useRef(`elevation-progress-gradient-${Math.random().toString(36).slice(2)}`);
  const [progressRatio, setProgressRatio] = useState(0);

  useEffect(() => {
    if (rideDistance == null || !totalDistance) return;
    const ratio = Math.min(rideDistance / totalDistance, 1);
    setProgressRatio(ratio);
  }, [rideDistance, totalDistance]);

  if (elevations.length < 2) return null;

  const handleTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!onPositionChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.floor(ratio * (elevations.length - 1));
    const distance = (index / (elevations.length - 1)) * totalDistance;
    const elevation = elevations[index];
    onPositionChange(index, distance, elevation);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onPositionChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.floor(ratio * (elevations.length - 1));
    const distance = (index / (elevations.length - 1)) * totalDistance;
    onPositionChange(index, distance, elevations[index]);
  };

  const data = elevations.map((elev, i) => ({
    idx: i,
    elev: Math.round(elev),
    dist: parseFloat(((i / (elevations.length - 1)) * totalDistance / 1000).toFixed(1)),
  }));

  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const yMin = Math.floor(minElev / 10) * 10;
  const yMax = Math.ceil(maxElev / 10) * 10;

  return (
    <div className="mt-2 mb-1">
      <div style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={72}>
          <AreaChart data={data} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId.current} x1="0" y1="0" x2="1" y2="0">
                {rideDistance != null ? (
                  <>
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.9} />
                    <stop offset={`${progressRatio * 100}%`} stopColor="#D4AF37" stopOpacity={0.9} />
                    <stop offset={`${progressRatio * 100}%`} stopColor="#D4AF37" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.2} />
                  </>
                ) : (
                  <>
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.05} />
                  </>
                )}
              </linearGradient>
            </defs>
            <XAxis
              dataKey="idx"
              type="number"
              domain={[0, elevations.length - 1]}
              ticks={Array.from({length: 9}, (_, i) => {
                if (i === 0) return 0;
                if (i === 8) return elevations.length - 1;
                return Math.round(i / 8 * (elevations.length - 1));
              })}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickFormatter={(v) => {
                const km = (v / (elevations.length - 1)) * totalDistance / 1000;
                return `${Math.round(km * 10) / 10}km`;
              }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickFormatter={(v) => `${v}`}
              width={45}
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
              labelFormatter={(v) => {
                const km = (Number(v) / (elevations.length - 1)) * totalDistance / 1000;
                return `${Math.round(km * 10) / 10}km`;
              }}
            />
            <Area
              type="monotone"
              dataKey="elev"
              stroke="#D4AF37"
              strokeWidth={1.5}
              fill={`url(#${gradientId.current})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        {/* タッチ専用オーバーレイ */}
        <div
          onTouchStart={handleTouch}
          onTouchMove={handleTouch}
          onMouseMove={handleMouseMove}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 10,
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
