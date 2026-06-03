'use client';

import { useState } from 'react';
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
  navElevationIndex?: number;
  rideDistance?: number; // meters
}

export default function SpeedPanel({
  currentSpeed,
  maxSpeed,
  avgSpeed,
  navRoute,
  navElevations = [],
  navTotalDistance = 0,
  navElevationIndex,
  rideDistance = 0,
}: SpeedPanelProps) {
  const [showMax, setShowMax] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const displaySpeed = currentSpeed > 3 ? currentSpeed : 0;
  const subSpeed = showMax ? maxSpeed : avgSpeed;
  const subLabel = showMax ? '最高' : '平均';
  const rideKm = rideDistance / 1000;
  const remainingKm = Math.max(0, navTotalDistance / 1000 - rideKm);

  return (
    <div
      className="bg-[var(--surface)] border-t border-[var(--border)] shrink-0"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Nav route name */}
        {navRoute && (
          <div style={{ padding: '12px 16px 0' }}>
            <div className="bg-[var(--surface2)] rounded-xl px-3 py-2">
              <span className="text-[var(--text)] text-sm font-medium truncate block">
                {navRoute.name}
              </span>
            </div>
          </div>
        )}

        {/* Speed row: sub / current / distance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }}>
          {/* 平均⇔最高（タップ切替） */}
          <div
            style={{ flex: 1, textAlign: 'center', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            onClick={() => setShowMax((prev) => !prev)}
          >
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{subLabel}</div>
            <div style={{ fontSize: '20px', fontWeight: '700' }}>{subSpeed.toFixed(1)}</div>
            <div style={{ fontSize: '10px', color: '#888' }}>km/h</div>
          </div>

          {/* 現在速度 */}
          <div style={{ flex: 2, textAlign: 'center' }}>
            <div style={{ fontSize: '56px', fontWeight: '800', lineHeight: 1, color: '#D4AF37' }}>{displaySpeed.toFixed(1)}</div>
            <div style={{ fontSize: '13px', color: '#888' }}>km/h</div>
          </div>

          {/* 走行距離⇔残距離（タップ切替） */}
          <div
            style={{ flex: 1, textAlign: 'center', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            onClick={() => setShowRemaining((prev) => !prev)}
          >
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
              {showRemaining ? '残距離' : '走行距離'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700' }}>
              {showRemaining ? remainingKm.toFixed(2) : rideKm.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: '#888' }}>km</div>
          </div>
        </div>

        {/* Elevation chart for loaded route */}
        {navElevations.length >= 2 && (
          <div style={{ padding: '0 16px 8px' }}>
            <ElevationChart elevations={navElevations} totalDistance={navTotalDistance} currentIndex={navElevationIndex} />
          </div>
        )}
      </div>
    </div>
  );
}
