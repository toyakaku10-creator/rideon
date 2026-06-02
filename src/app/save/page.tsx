'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { SavedRoute, LatLng, RouteType, RouteSegment } from '@/types';

const STORAGE_KEY = 'cycle-map-routes';

interface PendingRoute {
  waypoints: LatLng[];
  routeType: RouteType;
  segments: RouteSegment[];
  totalDistance: number;
  elevations?: number[];
}

export default function SavePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, setPending] = useState<PendingRoute | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('cycle-map-save-pending');
    if (!raw) { router.replace('/'); return; }
    try {
      setPending(JSON.parse(raw) as PendingRoute);
    } catch {
      router.replace('/');
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [router]);

  const handleConfirm = () => {
    if (!name.trim() || !pending) return;
    const route: SavedRoute = {
      id: Date.now().toString(),
      name: name.trim(),
      waypoints: pending.waypoints,
      routeType: pending.routeType,
      segments: pending.segments,
      totalDistance: pending.totalDistance,
      createdAt: new Date().toISOString(),
      elevations: pending.elevations && pending.elevations.length >= 2 ? pending.elevations : undefined,
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const existing: SavedRoute[] = raw ? (JSON.parse(raw) as SavedRoute[]) : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, route]));
    } catch { /* ignore */ }
    sessionStorage.removeItem('cycle-map-save-pending');
    router.push('/');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#ffffff', display: 'flex', flexDirection: 'column', maxWidth: '480px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#1a1a1a' }}>ルートを保存</h2>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', lineHeight: 1 }}
        >✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '24px 16px 16px', boxSizing: 'border-box' }}>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          placeholder="ルート名（例：自宅→駅）"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '10px', outline: 'none' }}
        />
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, padding: '16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
        <button
          onClick={handleConfirm}
          disabled={!name.trim() || !pending}
          style={{ width: '100%', padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', opacity: !name.trim() || !pending ? 0.4 : 1 }}
        >
          保存する
        </button>
      </div>
    </div>
  );
}
