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
  elevationIndex?: number | null;
}

export default function ElevationChart({ elevations, totalDistance, onPositionChange, rideDistance, elevationIndex }: ElevationChartProps) {
  const gradientId = useRef(`elevation-progress-gradient-${Math.random().toString(36).slice(2)}`);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const [progressRatio, setProgressRatio] = useState(0);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  useEffect(() => {
    if (rideDistance == null || !totalDistance) return;
    const ratio = Math.min(rideDistance / totalDistance, 1);
    setProgressRatio(ratio);
  }, [rideDistance, totalDistance]);

  if (elevations.length < 2) return null;

  const displayRatio = hoverRatio ?? progressRatio;

  const indexFromClientX = (clientX: number): number => {
    const track = sliderTrackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * (elevations.length - 1));
  };

  const updateFromClientX = (clientX: number) => {
    const index = indexFromClientX(clientX);
    setHoverRatio(index / (elevations.length - 1));
    if (!onPositionChange) return;
    const distance = (index / (elevations.length - 1)) * totalDistance;
    onPositionChange(index, distance, elevations[index]);
  };

  const handleSliderPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    updateFromClientX(clientX);
  };

  const handleSliderPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.type === 'mousemove' && !(e as React.MouseEvent).buttons) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    updateFromClientX(clientX);
  };

  const handleSliderRelease = () => {
    setHoverRatio(null);
    onPositionChange?.(-1, 0, 0);
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
          <AreaChart
            data={data}
            margin={{ top: 4, right: 20, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId.current} x1="0" y1="0" x2="1" y2="0">
                {hoverRatio != null || rideDistance != null ? (
                  <>
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.9} />
                    <stop offset={`${displayRatio * 100}%`} stopColor="#D4AF37" stopOpacity={0.9} />
                    <stop offset={`${displayRatio * 100}%`} stopColor="#D4AF37" stopOpacity={0.2} />
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
            <Tooltip active={false} />
            <Area
              type="monotone"
              dataKey="elev"
              stroke="#D4AF37"
              strokeWidth={1.5}
              fill={`url(#${gradientId.current})`}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div
          ref={sliderTrackRef}
          onMouseDown={handleSliderPointerDown}
          onMouseMove={handleSliderPointerMove}
          onMouseUp={handleSliderRelease}
          onMouseLeave={handleSliderRelease}
          onTouchStart={(e) => { e.preventDefault(); handleSliderPointerDown(e); }}
          onTouchMove={(e) => { e.preventDefault(); handleSliderPointerMove(e); }}
          onTouchEnd={handleSliderRelease}
          style={{
            position: 'absolute',
            left: '35px',
            right: '20px',
            bottom: '14px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            touchAction: 'none',
            cursor: 'pointer',
          }}
        >
          <div style={{ width: '100%', height: '3px', background: 'rgba(212,175,55,0.35)', borderRadius: '2px', position: 'relative' }}>
            {hoverRatio != null && (
              <div style={{
                position: 'absolute',
                left: `calc(${hoverRatio * 100}% - 6px)`,
                top: '-5px',
                width: '13px',
                height: '13px',
                borderRadius: '50%',
                background: '#D4AF37',
                border: '2px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
