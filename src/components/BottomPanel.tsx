'use client';

import { useState, useRef, useEffect } from 'react';
import { Ruler, Bike, Footprints, Undo2, X, Share2, Upload } from 'lucide-react';
import type { RouteType, LatLng, RouteSegment, SavedRoute } from '@/types';
import { encodeRoute } from '@/lib/routeShare';

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

const ROUTE_BUTTONS: { type: RouteType; icon: React.ReactNode; label: string }[] = [
  { type: 'straight', icon: <Ruler size={13} />, label: '直線' },
  { type: 'cycling', icon: <Bike size={13} />, label: '自転車道なり' },
  { type: 'walking', icon: <Footprints size={13} />, label: '徒歩道なり' },
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
  onImportUrl: (url: string) => Promise<true | string>;
  isImported: boolean;
  onImportedSaved: () => void;
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
  onImportUrl,
  isImported,
  onImportedSaved,
}: BottomPanelProps) {
  const [showSave, setShowSave] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [saveName, setSaveName] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSave) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showSave]);

  const handleShare = async () => {
    const encoded = encodeRoute(waypoints, segments, routeType);
    const url = `${window.location.origin}${window.location.pathname}?route=${encodeURIComponent(encoded)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'cycle-map ルート', url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // user cancelled or clipboard unavailable
    }
  };

  const handleImportConfirm = async () => {
    if (!importUrl.trim() || importLoading) return;
    setImportLoading(true);
    setImportError('');
    const result = await onImportUrl(importUrl.trim());
    setImportLoading(false);
    if (result === true) {
      setShowImport(false);
      setImportUrl('');
      setSaveName('');
      setShowSave(true); // 保存ダイアログを開く
    } else if (typeof result === 'string') {
      setImportError(result);
    }
  };

  const handleSaveConfirm = () => {
    if (!saveName.trim()) return;
    onSave(saveName.trim());
    setSaveName('');
    setShowSave(false);
    onImportedSaved();
  };

  const speedKmh = ROUTE_SPEED[routeType];

  return (
    <>
      <div
        className="bg-[var(--surface)] border-t border-[var(--border)] px-4 pt-3 shrink-0"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {/* Route type selector */}
        <div className="flex gap-1.5 mb-3">
          {ROUTE_BUTTONS.map(({ type, icon, label }) => (
            <button
              key={type}
              onClick={() => !isLoading && onRouteTypeChange(type)}
              disabled={isLoading}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                routeType === type
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface2)] text-[var(--text-muted)] hover:text-[var(--text)] active:bg-[var(--border)]'
              } disabled:opacity-50`}
            >
              <span className="flex items-center justify-center gap-1">
                {icon}
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-[var(--text)] font-semibold tabular-nums">
            {formatDistance(totalDistance)}
          </span>
          <span className="text-[var(--text-muted)]">{waypoints.length}ポイント</span>
          <span className="text-[var(--text-muted)]">
            目安{' '}
            {totalDistance > 0 ? formatTime(totalDistance, speedKmh) : '--'}
          </span>
        </div>

        {/* Import hint */}
        {isImported && (
          <p className="text-[var(--text-muted)] text-xs text-center mb-2">
            📍 スタート地点をドラッグするとルート全体が移動します
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {[
            {
              key: 'undo',
              content: (
                <span className="flex items-center justify-center gap-1">
                  <Undo2 size={13} />戻す
                </span>
              ),
              onClick: onUndo,
              disabled: waypoints.length === 0,
            },
            {
              key: 'save',
              content: '保存',
              onClick: () => { setSaveName(''); setShowSave(true); },
              disabled: waypoints.length < 2,
            },
            {
              key: 'share',
              content: (
                <span className="flex items-center justify-center gap-1">
                  <Share2 size={13} />
                  {copied ? 'コピー済' : 'シェア'}
                </span>
              ),
              onClick: handleShare,
              disabled: waypoints.length < 2,
            },
            {
              key: 'import',
              content: (
                <span className="flex items-center justify-center gap-1">
                  <Upload size={13} />インポート
                </span>
              ),
              onClick: () => { setImportUrl(''); setImportError(''); setShowImport(true); },
              disabled: false,
            },
            {
              key: 'history',
              content: '履歴',
              onClick: () => setShowHistory(true),
              disabled: false,
            },
            {
              key: 'clear',
              content: 'クリア',
              onClick: onClear,
              disabled: waypoints.length === 0,
            },
          ].map(({ key, content, onClick, disabled }) => (
            <button
              key={key}
              onClick={onClick}
              disabled={disabled}
              className="flex-1 py-2 rounded-lg bg-[var(--surface2)] text-xs text-[var(--text-muted)] disabled:opacity-40 hover:bg-[var(--border)] active:bg-[var(--border)] transition-colors"
            >
              {content}
            </button>
          ))}
        </div>
      </div>

      {/* Save bottom sheet */}
      {showSave && (
        <div className="fixed inset-0 z-[1000] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSave(false)}
          />
          <div
            className="relative bg-[var(--surface)] rounded-t-2xl px-4 pt-6 border-t border-[var(--border)]"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-5" />
            <h2 className="text-[var(--text)] font-semibold text-base mb-4">
              ルート名を入力
            </h2>
            <input
              ref={inputRef}
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveConfirm()}
              placeholder="例：通勤ルート"
              className="w-full bg-[var(--surface2)] text-[var(--text)] rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)]"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSave(false)}
                className="flex-1 py-3 rounded-xl bg-[var(--surface2)] text-[var(--text-muted)] text-sm font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveConfirm}
                disabled={!saveName.trim()}
                className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-sm disabled:opacity-40"
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
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowHistory(false)}
          />
          <div
            className="relative bg-[var(--surface)] rounded-t-2xl border-t border-[var(--border)] flex flex-col"
            style={{ maxHeight: '70dvh' }}
          >
            <div className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
              <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <h2 className="text-[var(--text)] font-semibold text-base">
                  保存済みルート
                </h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text)] w-8 h-8 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {savedRoutes.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm text-center py-10">
                  保存済みルートはありません
                </p>
              ) : (
                [...savedRoutes].reverse().map((route) => (
                  <div
                    key={route.id}
                    className="flex items-center px-4 py-3 border-b border-[var(--border)]"
                  >
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => {
                        onLoadRoute(route);
                        setShowHistory(false);
                      }}
                    >
                      <p className="text-[var(--text)] text-sm font-medium truncate">
                        {route.name}
                      </p>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5">
                        {formatDistance(route.totalDistance)} ·{' '}
                        {route.waypoints.length}ポイント ·{' '}
                        {new Date(route.createdAt).toLocaleDateString('ja-JP')}
                      </p>
                    </button>
                    <button
                      onClick={() => onDeleteRoute(route.id)}
                      className="ml-3 text-xs text-[var(--text-muted)] hover:text-[var(--red)] transition-colors px-2 py-1 shrink-0"
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
      {/* Import bottom sheet */}
      {showImport && (
        <div className="fixed inset-0 z-[1000] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !importLoading && setShowImport(false)}
          />
          <div
            className="relative bg-[var(--surface)] rounded-t-2xl border-t border-[var(--border)]"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
          >
            <div className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
              <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <h2 className="text-[var(--text)] font-semibold text-base">
                  キョリ測からインポート
                </h2>
                <button
                  onClick={() => !importLoading && setShowImport(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text)] w-8 h-8 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="px-4 pt-4">
              <p className="text-[var(--text-muted)] text-xs mb-3">
                キョリ測のURLをペーストしてください
              </p>
              <input
                type="url"
                value={importUrl}
                onChange={(e) => { setImportUrl(e.target.value); setImportError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleImportConfirm()}
                placeholder="https://mapzs.com/map/..."
                disabled={importLoading}
                className="w-full bg-[var(--surface2)] text-[var(--text)] rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)] disabled:opacity-50"
              />
              {importError && (
                <p className="text-[var(--red)] text-xs mb-3 px-1">{importError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => !importLoading && setShowImport(false)}
                  disabled={importLoading}
                  className="flex-1 py-3 rounded-xl bg-[var(--surface2)] text-[var(--text-muted)] text-sm font-medium disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleImportConfirm}
                  disabled={!importUrl.trim() || importLoading}
                  className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {importLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      取得中…
                    </>
                  ) : (
                    '取得する'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
