'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Undo2, Save, Trash2, Share2, Upload, Download, MapPinPlus, Flag, Ruler, Road, Pencil, Check, Database } from 'lucide-react';
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
  onRename,
}: {
  route: SavedRoute;
  onLoad: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(route.name);
  const startXRef = useRef<number | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
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

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(route.name);
    setEditing(true);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const commitEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== route.name) onRename(trimmed);
    setEditing(false);
  };

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
        onClick={() => { if (!revealed && !editing) onLoad(); }}
      >
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', boxSizing: 'border-box', padding: '4px 8px', fontSize: '14px', border: '1px solid #D4AF37', borderRadius: '6px', outline: 'none', fontWeight: '500' }}
            />
          ) : (
            <p className="text-[var(--text)] text-sm font-medium truncate">{route.name}</p>
          )}
          <p className="text-[var(--text-muted)] text-xs mt-0.5">
            {formatDistance(route.totalDistance)} ·{' '}
            {route.waypoints.length}ポイント ·{' '}
            {new Date(route.createdAt).toLocaleDateString('ja-JP')}
          </p>
        </div>
        {editing ? (
          <button
            onClick={(e) => { e.stopPropagation(); commitEdit(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D4AF37', padding: '4px', flexShrink: 0 }}
          >
            <Check size={18} />
          </button>
        ) : (
          <button
            onClick={startEdit}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '4px', flexShrink: 0 }}
          >
            <Pencil size={15} />
          </button>
        )}
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
  openSaveSheet?: boolean;
  onSaveSheetClose?: () => void;
  savedRoutes: SavedRoute[];
  onLoadRoute: (route: SavedRoute) => void;
  onDeleteRoute: (id: string) => void;
  onRenameRoute: (id: string, newName: string) => void;
  onImportRoutes: (imported: SavedRoute[]) => void;
  onImportClick: () => void;
  isImported: boolean;
  elevations?: number[];
  onElevationPositionChange?: (index: number) => void;
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
  openSaveSheet,
  onSaveSheetClose,
  savedRoutes,
  onLoadRoute,
  onDeleteRoute,
  onRenameRoute,
  onImportRoutes,
  onImportClick,
  isImported,
  elevations = [],
  onElevationPositionChange,
}: BottomPanelProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [showDataMenu, setShowDataMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [copied, setCopied] = useState(false);

  // 外部から保存シートを開く（インポート完了後など）
  const prevOpenSaveSheet = useRef(false);
  useEffect(() => {
    if (openSaveSheet && !prevOpenSaveSheet.current) {
      setRouteName('');
      setShowSaveSheet(true);
    }
    prevOpenSaveSheet.current = !!openSaveSheet;
  }, [openSaveSheet]);

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

  const handleExport = () => {
    const json = JSON.stringify(savedRoutes, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rideon-routes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string) as SavedRoute[];
        onImportRoutes(imported);
      } catch {
        alert('ファイルの形式が正しくありません');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
            <ElevationChart elevations={elevations} totalDistance={totalDistance} onPositionChange={onElevationPositionChange} />
          </div>
        )}

        {/* Import hint */}
        {isImported && (
          <p className="text-[var(--text-muted)] text-xs text-center mb-1 px-4">
            📍 スタート地点をドラッグするとルート全体が移動します
          </p>
        )}

        {/* 4-button tab bar */}
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
              onClick: () => { setRouteName(''); setShowSaveSheet(true); },
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

      {/* 保存ボトムシート */}
      {showSaveSheet && (
        <>
          <div
            onClick={() => { setShowSaveSheet(false); onSaveSheetClose?.(); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000 }}
          />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#fff', borderRadius: '16px 16px 0 0', padding: '20px 16px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', zIndex: 1001, boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>ルートを保存</h3>
            <input
              type="text"
              placeholder="ルート名（例：自宅→駅）"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && routeName.trim() && (onSave(routeName.trim()), setShowSaveSheet(false), setRouteName(''))}
              autoFocus
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '10px', marginBottom: '12px', WebkitAppearance: 'none' } as React.CSSProperties}
            />
            <button
              onClick={() => { if (!routeName.trim()) return; onSave(routeName.trim()); setShowSaveSheet(false); setRouteName(''); }}
              disabled={!routeName.trim()}
              style={{ display: 'block', width: '100%', padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', opacity: !routeName.trim() ? 0.4 : 1 }}
            >保存する</button>
          </div>
        </>
      )}

      {/* History modal */}
      {showHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#ffffff', zIndex: 2000, display: 'flex', flexDirection: 'column', maxWidth: '480px', width: '100%', margin: '0 auto', boxSizing: 'border-box' } as React.CSSProperties}>
          {/* Header */}
          <div style={{ flexShrink: 0, padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--text)' }}>マイルート</h2>
            <button style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }} onClick={() => setShowHistory(false)}>✕</button>
          </div>

          {/* Action buttons */}
          {(() => {
            const btnStyle: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 4px', background: '#f5f5f5', border: '1px solid #eee', borderRadius: '10px', cursor: 'pointer', fontSize: '10px', color: '#333' };
            const subBtnStyle: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 4px', background: '#f5f5f5', border: '1px solid #eee', borderRadius: '10px', cursor: 'pointer', fontSize: '10px', color: '#333' };
            return (
              <div style={{ flexShrink: 0, padding: '0 16px 12px', borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleShare} disabled={waypoints.length < 2} style={{ ...btnStyle, opacity: waypoints.length < 2 ? 0.4 : 1 }}>
                    <Share2 size={20} color="#D4AF37" /><span>{copied ? 'コピー済み' : 'シェア'}</span>
                  </button>
                  <button onClick={() => { setShowHistory(false); onImportClick(); }} style={btnStyle}>
                    <MapPinPlus size={20} color="#D4AF37" /><span>キョリ測</span><span>取込み</span>
                  </button>
                  <button onClick={() => setShowDataMenu((prev) => !prev)} style={btnStyle}>
                    <Database size={20} color="#D4AF37" /><span>データ管理</span>
                  </button>
                </div>
                {showDataMenu && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <label style={subBtnStyle}>
                      <Download size={20} color="#D4AF37" /><span>読込み</span>
                      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
                    </label>
                    <button onClick={handleExport} disabled={savedRoutes.length === 0} style={{ ...subBtnStyle, opacity: savedRoutes.length === 0 ? 0.4 : 1 }}>
                      <Upload size={20} color="#D4AF37" /><span>書出し</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Route list */}
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box' } as React.CSSProperties}>
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
                  onRename={(newName) => onRenameRoute(route.id, newName)}
                />
              ))
            )}
            <div style={{ height: 'calc(20px + env(safe-area-inset-bottom))' }} />
          </div>
        </div>
      )}

    </>
  );
}
