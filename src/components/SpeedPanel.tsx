'use client';

import { useState } from 'react';
import { Navigation } from 'lucide-react';
import type { SavedRoute } from '@/types';

interface SpeedPanelProps {
  currentSpeed: number; // km/h
  maxSpeed: number;
  avgSpeed: number;
  gpsAccuracy: number | null;
  navDistance: number; // meters — 0 means no nav route
  navRoute: SavedRoute | null;
  savedRoutes: SavedRoute[];
  onSelectNavRoute: (route: SavedRoute | null) => void;
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
  savedRoutes,
  onSelectNavRoute,
}: SpeedPanelProps) {
  const [showRouteList, setShowRouteList] = useState(false);

  return (
    <div
      className="bg-[var(--surface)] border-t border-[var(--border)] px-4 pt-4 shrink-0"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      {/* Route selector */}
      <div className="mb-3">
        {navRoute ? (
          <div className="flex items-center justify-between bg-[var(--surface2)] rounded-xl px-3 py-2">
            <span className="text-[var(--text)] text-sm font-medium truncate flex-1 mr-2">
              {navRoute.name}
            </span>
            <button
              onClick={() => { onSelectNavRoute(null); setShowRouteList(false); }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] shrink-0 border border-[var(--border)] rounded-lg px-2 py-1"
            >
              解除
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setShowRouteList((v) => !v)}
              className="w-full text-sm font-medium border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text)] text-left"
            >
              {showRouteList ? 'ルートを閉じる ▲' : 'ルートを選択 ▼'}
            </button>
            {showRouteList && (
              <div className="mt-1 border border-[var(--border)] rounded-xl overflow-hidden">
                {savedRoutes.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] text-center py-3">保存済みルートがありません</p>
                ) : (
                  savedRoutes.map((route) => (
                    <button
                      key={route.id}
                      onClick={() => { onSelectNavRoute(route); setShowRouteList(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface2)] border-b border-[var(--border)] last:border-b-0 flex items-center justify-between"
                    >
                      <span className="text-[var(--text)] truncate flex-1 mr-2">{route.name}</span>
                      <span className="text-[var(--text-muted)] text-xs shrink-0">{formatNavDistance(route.totalDistance)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Current speed — big display */}
      <div className="text-center mb-4">
        <span className="text-6xl font-bold text-[var(--accent)] tabular-nums">
          {currentSpeed.toFixed(1)}
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
    </div>
  );
}
