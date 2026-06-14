'use client';

import React, { useState } from 'react';
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
  demoElevIndexRef?: React.RefObject<number>;
  demoProgressRef?: React.RefObject<number>;
}

const SpeedMeter = ({ speed }: { speed: number }) => {
  const maxSpeed = 60
  const angle = Math.min((speed / maxSpeed) * 180, 180)
  const rad = (angle - 180) * Math.PI / 180
  const cx = 110, cy = 115, r = 85
  const x = cx + r * Math.cos(rad)
  const y = cy + r * Math.sin(rad)
  const largeArc = angle > 180 ? 1 : 0

  return (
    <svg viewBox="15 20 190 105" width="160" height="88">
      <path d="M 25 115 A 85 85 0 0 1 195 115" fill="none" stroke="#e8e8e8" strokeWidth="14" strokeLinecap="round"/>
      <path d={`M 25 115 A 85 85 0 ${largeArc} 1 ${x} ${y}`} fill="none" stroke="#D4AF37" strokeWidth="14" strokeLinecap="round"/>
      {[0,15,30,45,60].map((v) => {
        const a = (v / maxSpeed * 180 - 180) * Math.PI / 180
        const x1 = cx + 74 * Math.cos(a), y1 = cy + 74 * Math.sin(a)
        const x2 = cx + 84 * Math.cos(a), y2 = cy + 84 * Math.sin(a)
        return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ccc" strokeWidth="2"/>
      })}
      <line x1={cx} y1={cy} x2={x} y2={y} stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r="7" fill="#D4AF37"/>
      <circle cx={cx} cy={cy} r="3" fill="white"/>
      <text
        x={cx} y={cy - 30} textAnchor="middle" fontSize="24" fontWeight="bold" fill="#333"
        style={{ transformBox: 'fill-box' as React.CSSProperties['transformBox'], transformOrigin: 'center', transform: 'scaleY(-1)' }}
      >{speed.toFixed(1)}</text>
      <text
        x={cx} y={cy - 16} textAnchor="middle" fontSize="11" fill="#999"
        style={{ transformBox: 'fill-box' as React.CSSProperties['transformBox'], transformOrigin: 'center', transform: 'scaleY(-1)' }}
      >km/h</text>
    </svg>
  )
}

const FLIP_TEXT: React.CSSProperties = { display: 'block', transform: 'scaleY(-1)' };

export default function SpeedPanel({
  currentSpeed,
  maxSpeed,
  avgSpeed,
  navRoute,
  navElevations = [],
  navTotalDistance = 0,
  navElevationIndex,
  rideDistance = 0,
  demoElevIndexRef,
  demoProgressRef,
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
      className="bg-[var(--surface)]"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 500,
        transform: 'scaleY(-1)',
      }}
    >
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Nav route name */}
        {navRoute && (
          <div style={{ padding: '8px 16px 0' }}>
            <div className="bg-[var(--surface2)] rounded-xl px-3 py-2">
              <span className="text-[var(--text)] text-sm font-medium truncate" style={FLIP_TEXT}>
                {navRoute.name}
              </span>
            </div>
          </div>
        )}

        {/* Speed row: sub / meter bubble / distance */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '4px 16px 8px' }}>
          {/* 平均⇔最高（タップ切替） */}
          <div
            style={{ flex: 1, textAlign: 'center', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            onClick={() => setShowMax((prev) => !prev)}
          >
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px', ...FLIP_TEXT }}>{subLabel}</div>
            <div style={{ fontSize: '16px', fontWeight: '700', ...FLIP_TEXT }}>{subSpeed.toFixed(1)}</div>
            <div style={{ fontSize: '10px', color: '#888', ...FLIP_TEXT }}>km/h</div>
          </div>

          {/* 現在速度（メーター泡） — absolute で飛び出す */}
          <div style={{ flex: 2 }} />
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            top: '-45px',
            background: '#fff',
            width: '170px',
            height: '95px',
            borderRadius: '85px 85px 0 0',
            padding: 0,
            margin: 0,
            lineHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 10,
          }}>
            <SpeedMeter speed={displaySpeed} />
          </div>

          {/* 走行距離⇔残距離（タップ切替） */}
          <div
            style={{ flex: 1, textAlign: 'center', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            onClick={() => setShowRemaining((prev) => !prev)}
          >
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px', ...FLIP_TEXT }}>
              {showRemaining ? '残り' : '走行距離'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', ...FLIP_TEXT }}>
              {showRemaining ? remainingKm.toFixed(2) : rideKm.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: '#888', ...FLIP_TEXT }}>km</div>
          </div>
        </div>

        {/* Elevation chart for loaded route */}
        {navElevations.length >= 2 && (
          <div style={{ padding: '0 16px 8px', transform: 'scaleY(-1)' }}>
            <ElevationChart
              elevations={navElevations}
              totalDistance={navTotalDistance}
              currentIndex={navElevationIndex}
              rideDistance={rideDistance}
            />
          </div>
        )}
      </div>
    </div>
  );
}
