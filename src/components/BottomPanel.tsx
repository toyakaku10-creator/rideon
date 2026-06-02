'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Undo2, Save, Trash2, X, Share2, Upload, MoreHorizontal, BookMarked, Flag, Ruler, Road } from 'lucide-react';
import type { RouteType, LatLng, RouteSegment, SavedRoute } from '@/types';
import { encodeRoute } from '@/lib/routeShare';
import ElevationChart from '@/components/ElevationChart';

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
  walking: 15,
};

const ROUTE_BUTTONS: { type: RouteType; icon: React.ReactNode; label: string }[] = [
  { type: 'cycling', icon: <Road size={13} />, label: '道なり' },
  { type: 'straight', icon: <Ruler size={13} />, label: '直線' },
];

function SwipeableRouteItem({
  route,
  onLoad,
  onDelete,
}: {
  route: SavedRoute;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const startXRef = useRef<number | null>(null);
  const revealed = offset <= -80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startXRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    if (dx < 0) {
      e.preventDefault();
      setOffset(Math.max(dx, -80));
    } else if (dx > 0 && offset < 0) {
      e.preventDefault();
      setOffset(Math.min(0, offset + dx));
    }
  }, [offset]);

  const handleTouchEnd = useCallback(() => {
    startXRef.current = null;
    setOffset(offset <= -40 ? -80 : 0);
  }, [offset]);

  return (
    <div className="relative overflow-hidden border-b border-[var(--border)]">
      {/* Delete button */}
      <div
        className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center text-white text-sm font-bold"
        style={{ background: '#E53935' }}
        onClick={onDelete}
      >
        削除
      </div>
      {/* Row content */}
      <div
        className="flex items-center px-4 py-3 bg-[var(--surface)]"
        style={{
          transform: `translateX(${offset}px)`,
          transition: startXRef.current === null ? 'transform 0.2s' : 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (!revealed) onLoad(); }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[var(--text)] text-sm font-medium truncate">{route.name}</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">
            {formatDistance(route.totalDistance)} ·{' '}
            {route.waypoints.length}ポイント ·{' '}
            {new Date(route.createdAt).toLocaleDateString('ja-JP')}
          </p>
        </div>
      </div>
    </div>
  );
}

interface BottomPanelProps {
  waypoints: LatLng[];
  segments: RouteSegment[];
  routeType: RouteType;
  totalDistance: number;
  isLoading: boolean;
  onRouteTypeChange: (type: RouteType) => void;
  onUndo: () => void;
  onClear: () => void;
  onSave: (name: string) => void | Promise<void>;
  savedRoutes: SavedRoute[];
  onLoadRoute: (route: SavedRoute) => void;
  onDeleteRoute: (id: string) => void;
  onImportUrl: (url: string) => Promise<true | string>;
  isImported: boolean;
  onImportedSaved: () => void;
  showSaveDialog?: boolean;
  onShowSaveDialogChange?: (open: boolean) => void;
  elevations?: number[];
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
  showSaveDialog,
  onShowSaveDialogChange,
  elevations = [],
}: BottomPanelProps) {
  const [showSave, setShowSave] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [saveName, setSaveName] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSave) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showSave]);

  useEffect(() => {
    if (showSaveDialog) {
      setSaveName('');
      setShowSave(true);
      onShowSaveDialogChange?.(false);
    }
  }, [showSaveDialog, onShowSaveDialogChange]);

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
        className="bg-[var(--surface)] border-t border-[var(--border)] shrink-0"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Route type selector */}
        <div className="flex gap-1.5 px-4 pt-3 mb-2">
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
        <div className="flex items-center justify-between text-sm px-4 mb-2">
          <span className="text-[var(--text)] font-semibold tabular-nums">
            {formatDistance(totalDistance)}
          </span>
          <span className="text-[var(--text-muted)]">{waypoints.length}ポイント</span>
          <span className="text-[var(--text-muted)]">
            目安{' '}
            {totalDistance > 0 ? formatTime(totalDistance, speedKmh) : '--'}
          </span>
        </div>

        {/* Elevation chart */}
        {elevations.length >= 2 && (
          <div className="px-4">
            <ElevationChart elevations={elevations} totalDistance={totalDistance} />
          </div>
        )}

        {/* Import hint */}
        {isImported && (
          <p className="text-[var(--text-muted)] text-xs text-center mb-1 px-4">
            📍 スタート地点をドラッグするとルート全体が移動します
          </p>
        )}

        {/* 5-button tab bar */}
        <div className="flex" style={{ maxWidth: '480px', margin: '0 auto' }}>
          {[
            {
              icon: <Undo2 size={24} />,
              label: '戻す',
              onClick: onUndo,
              disabled: waypoints.length === 0,
            },
            {
              icon: <Save size={24} />,
              label: '保存',
              onClick: () => { setSaveName(''); setShowSave(true); },
              disabled: waypoints.length < 2,
            },
            {
              icon: <Trash2 size={24} />,
              label: 'クリア',
              onClick: onClear,
              disabled: waypoints.length === 0,
            },
            {
              icon: <Flag size={24} />,
              label: 'マイルート',
              onClick: () => setShowHistory(true),
              disabled: false,
            },
            {
              icon: <MoreHorizontal size={24} />,
              label: '外部',
              onClick: () => setShowMore(true),
              disabled: false,
            },
          ].map(({ icon, label, onClick, disabled }) => (
            <button
              key={label}
              onClick={onClick}
              disabled={disabled}
              className="flex-1 py-2 flex flex-col items-center gap-0.5 text-[var(--text-muted)] disabled:opacity-35 active:text-[#D4AF37] transition-colors"
            >
              {icon}
              <span style={{ fontSize: '10px' }}>{label}</span>
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* More menu modal */}
      {showMore && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#ffffff', zIndex: 2000, display: 'flex', flexDirection: 'column', maxWidth: '480px', width: '100%', margin: '0 auto', boxSizing: 'border-box', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <div style={{ flexShrink: 0, padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--text)' }}>外部</h2>
            <button style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }} onClick={() => setShowMore(false)}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => { setImportUrl(''); setImportError(''); setShowMore(false); setShowImport(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', boxSizing: 'border-box', minWidth: 0, padding: '14px 16px', background: 'var(--surface2)', border: 'none', borderRadius: '12px', fontSize: '15px', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}
            >
              <Upload size={18} />インポート
            </button>
            <button
              onClick={() => { setShowMore(false); handleShare(); }}
              disabled={waypoints.length < 2}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', boxSizing: 'border-box', minWidth: 0, padding: '14px 16px', background: 'var(--surface2)', border: 'none', borderRadius: '12px', fontSize: '15px', color: 'var(--text)', cursor: 'pointer', textAlign: 'left', opacity: waypoints.length < 2 ? 0.4 : 1 }}
            >
              <Share2 size={18} />{copied ? 'コピー済み' : 'シェア'}
            </button>
          </div>
          <div style={{ flexShrink: 0, padding: '16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }} />
        </div>
      )}

      {/* Save modal */}
      {showSave && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#ffffff', zIndex: 2000, display: 'flex', flexDirection: 'column', maxWidth: '480px', width: '100%', margin: '0 auto', boxSizing: 'border-box', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <div style={{ flexShrink: 0, padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--text)' }}>ルートを保存</h2>
            <button style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }} onClick={() => setShowSave(false)}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', boxSizing: 'border-box' }}>
            <input
              ref={inputRef}
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveConfirm()}
              placeholder="ルート名（例：自宅→駅）"
              style={{ width: '100%', boxSizing: 'border-box', minWidth: 0, display: 'block', padding: '12px', fontSize: '15px', border: '1px solid #ddd', borderRadius: '10px', outline: 'none' }}
            />
          </div>
          <div style={{ flexShrink: 0, padding: '16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
            <button
              onClick={handleSaveConfirm}
              disabled={!saveName.trim()}
              style={{ width: '100%', padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', opacity: !saveName.trim() ? 0.4 : 1 }}
            >
              保存する
            </button>
          </div>
        </div>
      )}

      {/* History modal */}
      {showHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#ffffff', zIndex: 2000, display: 'flex', flexDirection: 'column', maxWidth: '480px', width: '100%', margin: '0 auto', boxSizing: 'border-box', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <div style={{ flexShrink: 0, padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--text)' }}>マイルート</h2>
            <button style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }} onClick={() => setShowHistory(false)}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', boxSizing: 'border-box' }}>
            {savedRoutes.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 16px' }}>
                保存済みルートはありません
              </p>
            ) : (
              [...savedRoutes].reverse().map((route) => (
                <SwipeableRouteItem
                  key={route.id}
                  route={route}
                  onLoad={() => { onLoadRoute(route); setShowHistory(false); }}
                  onDelete={() => onDeleteRoute(route.id)}
                />
              ))
            )}
            <div style={{ height: 'env(safe-area-inset-bottom)' }} />
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#ffffff', zIndex: 2000, display: 'flex', flexDirection: 'column', maxWidth: '480px', width: '100%', margin: '0 auto', boxSizing: 'border-box', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <div style={{ flexShrink: 0, padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--text)' }}>キョリ測からインポート</h2>
            <button style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }} onClick={() => !importLoading && setShowImport(false)}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', boxSizing: 'border-box' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
              キョリ測のURL
            </label>
            <input
              type="url"
              value={importUrl}
              onChange={(e) => { setImportUrl(e.target.value); setImportError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleImportConfirm()}
              placeholder="https://mapzs.com/map/..."
              disabled={importLoading}
              style={{ width: '100%', boxSizing: 'border-box', minWidth: 0, display: 'block', padding: '12px', fontSize: '15px', border: '1px solid #ddd', borderRadius: '10px', marginBottom: '12px', outline: 'none' }}
            />
            {importError && (
              <p style={{ color: 'var(--red)', fontSize: '12px', marginBottom: '12px' }}>{importError}</p>
            )}
          </div>
          <div style={{ flexShrink: 0, padding: '16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
            <button
              onClick={handleImportConfirm}
              disabled={!importUrl.trim() || importLoading}
              style={{ width: '100%', padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', opacity: (!importUrl.trim() || importLoading) ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {importLoading ? (
                <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />取得中…</>
              ) : '取得する'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
