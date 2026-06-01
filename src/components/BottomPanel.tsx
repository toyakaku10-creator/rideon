'use client';

import { useState, useRef, useEffect } from 'react';
import type { RouteType, LatLng, RouteSegment, SavedRoute } from '@/types';

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

function formatTime(meters: number, speedKmh: number): string {
  const totalMin = Math.round((meters / 1000 / speedKmh) * 60);
  if (totalMin === 0) return '1分未満';
  if (totalMin < 60) return `${totalMin}分`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}時間${m > 0 ? `${m}分` : ''}`;
}

const ROUTE_SPEED: Record<RouteType, number> = {
  straight: 15,
  cycling: 15,
  walking: 5,
};

const ROUTE_BUTTONS: { type: RouteType; label: string }[] = [
  { type: 'straight', label: '📏直線' },
  { type: 'cycling', label: '🚴自転車道なり' },
  { type: 'walking', label: '🚶徒歩道なり' },
];

interface BottomPanelProps {
  waypoints: LatLng[];
  segments: RouteSegment[];
  routeType: RouteType;
  totalDistance: number;
  isLoading: boolean;
  onRouteTypeChange: (type: RouteType) => void;
  onUndo: () => void;
  onClear: () => void;
  onSave: (name: string) => void;
  savedRoutes: SavedRoute[];
  onLoadRoute: (route: SavedRoute) => void;
  onDeleteRoute: (id: string) => void;
}

export default function BottomPanel({
  waypoints,
  segments,
  routeType,
  totalDistance,
  isLoading,
  onRouteTypeChange,
  onUndo,
  onClear,
  onSave,
  savedRoutes,
  onLoadRoute,
  onDeleteRoute,
}: BottomPanelProps) {
  const [showSave, setShowSave] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saveName, setSaveName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSave) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showSave]);

  const handleSaveConfirm = () => {
    if (!saveName.trim()) return;
    onSave(saveName.trim());
    setSaveName('');
    setShowSave(false);
  };

  const speedKmh = ROUTE_SPEED[routeType];

  return (
    <>
      <div className="bg-[#1a1a1a] border-t border-[#2a2a2a] px-4 pt-3 pb-safe shrink-0"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        {/* Route type selector */}
        <div className="flex gap-1.5 mb-3">
          {ROUTE_BUTTONS.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => !isLoading && onRouteTypeChange(type)}
              disabled={isLoading}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                routeType === type
                  ? 'bg-[#c8f55a] text-black'
                  : 'bg-[#2a2a2a] text-gray-400 hover:text-white active:bg-[#333]'
              } disabled:opacity-50`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-white font-semibold tabular-nums">
            {formatDistance(totalDistance)}
          </span>
          <span className="text-gray-400">{waypoints.length}ポイント</span>
          <span className="text-gray-400">
            目安{' '}
            {totalDistance > 0
              ? formatTime(totalDistance, speedKmh)
              : '--'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {[
            { label: '↩戻す', onClick: onUndo, disabled: waypoints.length === 0 },
            {
              label: '保存',
              onClick: () => { setSaveName(''); setShowSave(true); },
              disabled: waypoints.length < 2,
            },
            { label: '履歴', onClick: () => setShowHistory(true), disabled: false },
            { label: 'クリア', onClick: onClear, disabled: waypoints.length === 0 },
          ].map(({ label, onClick, disabled }) => (
            <button
              key={label}
              onClick={onClick}
              disabled={disabled}
              className="flex-1 py-2 rounded-lg bg-[#2a2a2a] text-sm text-gray-300 disabled:opacity-40 hover:bg-[#333] active:bg-[#3a3a3a] transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Save bottom sheet */}
      {showSave && (
        <div className="fixed inset-0 z-[1000] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowSave(false)}
          />
          <div className="relative bg-[#1a1a1a] rounded-t-2xl px-4 pt-6 border-t border-[#2a2a2a]"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
            <h2 className="text-white font-semibold text-base mb-4">
              ルート名を入力
            </h2>
            <input
              ref={inputRef}
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveConfirm()}
              placeholder="例：通勤ルート"
              className="w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:ring-2 focus:ring-[#c8f55a] placeholder-gray-600"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSave(false)}
                className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-gray-400 text-sm font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveConfirm}
                disabled={!saveName.trim()}
                className="flex-1 py-3 rounded-xl bg-[#c8f55a] text-black font-bold text-sm disabled:opacity-40"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History bottom sheet */}
      {showHistory && (
        <div className="fixed inset-0 z-[1000] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowHistory(false)}
          />
          <div
            className="relative bg-[#1a1a1a] rounded-t-2xl border-t border-[#2a2a2a] flex flex-col"
            style={{ maxHeight: '70dvh' }}
          >
            <div className="px-4 pt-4 pb-3 border-b border-[#2a2a2a]">
              <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold text-base">
                  保存済みルート
                </h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center text-xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {savedRoutes.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-10">
                  保存済みルートはありません
                </p>
              ) : (
                [...savedRoutes].reverse().map((route) => (
                  <div
                    key={route.id}
                    className="flex items-center px-4 py-3 border-b border-[#222]"
                  >
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => {
                        onLoadRoute(route);
                        setShowHistory(false);
                      }}
                    >
                      <p className="text-white text-sm font-medium truncate">
                        {route.name}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {formatDistance(route.totalDistance)} ·{' '}
                        {route.waypoints.length}ポイント ·{' '}
                        {new Date(route.createdAt).toLocaleDateString('ja-JP')}
                      </p>
                    </button>
                    <button
                      onClick={() => onDeleteRoute(route.id)}
                      className="ml-3 text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 shrink-0"
                    >
                      削除
                    </button>
                  </div>
                ))
              )}
              <div style={{ height: 'env(safe-area-inset-bottom)' }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
