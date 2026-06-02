'use client';

import { Navigation } from 'lucide-react';
import type { SavedRoute } from '@/types';
import ElevationChart from '@/components/ElevationChart';

interface SpeedPanelProps {
  currentSpeed: number; // km/h
  maxSpeed: number;
  avgSpeed: number;
  gpsAccuracy: number | null;
  navDistance: number; // meters — 0 means no nav route
  navRoute: SavedRoute | null;
  navElevations?: number[];
  navTotalDistance?: number;
}

function formatNavDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

export default function SpeedPanel({
  currentSpeed,
  maxSpeed,
  avgSpeed,
  gpsAccuracy,
  navDistance,
  navRoute,
  navElevations = [],
  navTotalDistance = 0,
}: SpeedPanelProps) {
  return (
    <div
      className="bg-[var(--surface)] border-t border-[var(--border)] shrink-0"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div className="px-4 pt-4" style={{ maxWidth: '480px', margin: '0 auto' }}>
      {/* Nav route name */}
      {navRoute && (
        <div className="mb-3 bg-[var(--surface2)] rounded-xl px-3 py-2">
          <span className="text-[var(--text)] text-sm font-medium truncate block">
            {navRoute.name}
          </span>
        </div>
      )}

      {/* Current speed — big display */}
      <div className="text-center mb-4">
        <span className="text-6xl font-bold text-[var(--accent)] tabular-nums">
          {currentSpeed > 3 ? currentSpeed.toFixed(1) : '0.0'}
        </span>
        <span className="text-xl text-[var(--text-muted)] ml-1.5">km/h</span>
      </div>

      {/* Nav route distance */}
      {navDistance > 0 && (
        <p className="text-[var(--text-muted)] text-xs text-center -mt-2 mb-3">
          ルート: {formatNavDistance(navDistance)}
        </p>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { label: '最高速度', value: `${maxSpeed.toFixed(1)}`, unit: 'km/h' },
            { label: '平均速度', value: `${avgSpeed.toFixed(1)}`, unit: 'km/h' },
            {
              label: (
                <span className="flex items-center justify-center gap-0.5">
                  <Navigation size={10} />GPS精度
                </span>
              ),
              value: gpsAccuracy != null ? `${Math.round(gpsAccuracy)}` : '--',
              unit: gpsAccuracy != null ? 'm' : '',
            },
          ] as { label: React.ReactNode; value: string; unit: string }[]
        ).map(({ label, value, unit }, i) => (
          <div
            key={i}
            className="bg-[var(--surface2)] rounded-xl py-2.5 px-2 text-center"
          >
            <p className="text-[var(--text-muted)] text-xs mb-1">{label}</p>
            <p className="text-[var(--text)] font-semibold text-base tabular-nums leading-none">
              {value}
              <span className="text-[var(--text-muted)] text-xs ml-0.5">{unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Elevation chart for loaded route */}
      {navElevations.length >= 2 && (
        <div style={{ padding: '0 0 8px' }}>
          <ElevationChart elevations={navElevations} totalDistance={navTotalDistance} />
        </div>
      )}
      </div>
    </div>
  );
}
