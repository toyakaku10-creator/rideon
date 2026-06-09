'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Undo2, Save, Trash2, Share2, Upload, Download, Flag, Ruler, Route, Repeat, Pencil, Check, Database, Link, Copy, FileInput, FileOutput, Droplets, Mountain, TrendingUp, AlertTriangle, Camera, Utensils, MapPin, Map, Clapperboard, GripVertical, type LucideProps } from 'lucide-react';
import type { RouteType, LatLng, RouteSegment, SavedRoute, RideLog, Spot } from '@/types';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SPOT_CATEGORIES, spotCustomSvg } from '@/lib/spotCategories';

const SPOT_ICONS: Record<string, React.ComponentType<LucideProps>> = {
  Droplets, Mountain, TrendingUp, AlertTriangle, Camera, Utensils, MapPin,
};

function SpotIcon({ category, size = 20 }: { category: string; size?: number }) {
  const custom = spotCustomSvg(category);
  if (custom) {
    return (
      <svg viewBox={custom.viewBox} width={size} height={size} fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: custom.inner }} />
    );
  }
  const cat = SPOT_CATEGORIES.find((c) => c.id === category);
  const Icon = SPOT_ICONS[cat?.icon ?? 'MapPin'] ?? MapPin;
  return <Icon size={size} color="#D4AF37" />;
}

const RIDE_LOG_KEY = 'rideon-logs';
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
  { type: 'cycling', icon: <Route size={13} />, label: '道なり' },
  { type: 'straight', icon: <Ruler size={13} />, label: '直線' },
];

const REVERSE_BUTTON = { icon: <Repeat size={13} />, label: '反転' };

function SwipeableRouteItem({
  route,
  onLoad,
  onDelete,
  onRename,
  onReference,
  isSelected,
  showMyRoute,
  dragHandleProps,
}: {
  route: SavedRoute;
  onLoad: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
  onReference?: () => void;
  isSelected?: boolean;
  showMyRoute?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
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

  useEffect(() => {
    setOffset(0);
  }, [showMyRoute]);

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
          userSelect: 'none',
          WebkitUserSelect: 'none',
        } as React.CSSProperties}
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
            <p className="text-[var(--text)] font-medium truncate" style={{ fontSize: '16px' }}>
              {route.name}
              {isSelected && (
                <span style={{ fontSize: '10px', color: '#fff', background: '#D4AF37', borderRadius: '8px', padding: '2px 8px', marginLeft: '6px', fontWeight: '600' }}>表示中</span>
              )}
            </p>
          )}
          <p className="text-[var(--text-muted)] mt-0.5" style={{ fontSize: '13px' }}>
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
          <div style={{ display: 'flex', gap: '2px', flexShrink: 0, alignItems: 'center' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onReference?.(); }}
              title="参考にして引き直す"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a73e8', padding: '4px' }}
            >
              <Copy size={15} />
            </button>
            <button
              onClick={startEdit}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '4px' }}
            >
              <Pencil size={15} />
            </button>
            <div
              {...dragHandleProps}
              onClick={(e) => e.stopPropagation()}
              style={{ color: '#ccc', padding: '4px', cursor: 'grab', touchAction: 'none' }}
            >
              <GripVertical size={15} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableRouteItem(props: React.ComponentProps<typeof SwipeableRouteItem>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.route.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 999 : undefined }}
    >
      <SwipeableRouteItem {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function SwipeableLogItem({
  log,
  onDelete,
  onShowRoute,
  onSaveAsRoute,
  onClearRoute,
  isSelected,
}: {
  log: RideLog;
  onDelete: () => void;
  onShowRoute?: () => void;
  onSaveAsRoute?: () => void;
  onClearRoute?: () => void;
  isSelected: boolean;
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

  const h = Math.floor(log.duration / 3600);
  const m = Math.floor((log.duration % 3600) / 60);
  const durationStr = h > 0 ? `${h}時間${m}分` : `${m}分`;

  return (
    <div className="relative overflow-hidden" style={{ borderBottom: '1px solid #eee' }}>
      {/* Delete button (revealed on swipe) */}
      <div
        className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center text-white text-sm font-bold"
        style={{ background: '#E53935' }}
        onClick={onDelete}
      >
        削除
      </div>
      {/* Row content */}
      <div
        style={{
          padding: '12px 0',
          background: 'var(--surface)',
          transform: `translateX(${offset}px)`,
          transition: startXRef.current === null ? 'transform 0.2s' : 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (revealed) setOffset(0); }}
      >
        <div style={{ fontSize: '13px', color: '#888', marginBottom: '4px' }}>
          {new Date(log.date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
          {log.routeName && <span style={{ marginLeft: '8px', color: '#D4AF37', fontWeight: '600' }}>{log.routeName}</span>}
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '20px', fontWeight: '700' }}>{log.distance.toFixed(2)}<span style={{ fontSize: '11px', color: '#888', marginLeft: '2px' }}>km</span></span>
          <span style={{ fontSize: '13px', color: '#555' }}>{durationStr}</span>
          <span style={{ fontSize: '13px', color: '#555' }}>平均 {log.avgSpeed.toFixed(1)} km/h</span>
          <span style={{ fontSize: '13px', color: '#555' }}>最高 {log.maxSpeed.toFixed(1)} km/h</span>
        </div>
        {log.track && log.track.length >= 2 && (
          <button
            onClick={(e) => { e.stopPropagation(); onShowRoute?.(); }}
            style={{ padding: '6px 12px', background: 'rgba(212, 175, 55, 0.15)', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
          >ルート表示</button>
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
  selectedRouteId?: string | null;
  onLoadRoute: (route: SavedRoute) => void;
  onDeleteRoute: (id: string) => void;
  onRenameRoute: (id: string, newName: string) => void;
  onImportRoutes: (imported: SavedRoute[]) => void;
  onImportClick: () => void;
  isImported: boolean;
  elevations?: number[];
  onElevationPositionChange?: (index: number) => void;
  rideDistance?: number;
  onReverseRoute?: () => void;
  onLoadRouteFromUrl?: (shareId: string) => void;
  onKyorisokuImport?: (points: { lat: number; lng: number }[], distance: number) => void;
  spots?: Spot[];
  onDeleteSpot?: (id: string) => void;
  sharedSpots?: Spot[];
  onSaveSharedSpots?: (spots: Spot[]) => void;
  onLoadRideLog?: (log: RideLog) => void;
  onSaveRideLogAsRoute?: (log: RideLog) => void;
  onClearRideLogRoute?: () => void;
  onModeChange?: (mode: string) => void;
  onReferenceRoute?: (route: SavedRoute) => void;
  onGpxImport?: (points: { lat: number; lng: number }[]) => void;
  onFetchElevation?: (points: { lat: number; lng: number }[]) => void;
  onDemoStart?: () => void;
  onShare?: () => void;
  isSpotMode?: boolean;
  onToggleSpotMode?: () => void;
  onReorderRoutes?: (routes: SavedRoute[]) => void;
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
  selectedRouteId,
  onLoadRoute,
  onDeleteRoute,
  onRenameRoute,
  onImportRoutes,
  onImportClick,
  isImported,
  elevations = [],
  onElevationPositionChange,
  rideDistance,
  onReverseRoute,
  onLoadRouteFromUrl,
  onKyorisokuImport,
  spots = [],
  onDeleteSpot,
  sharedSpots = [],
  onSaveSharedSpots,
  onLoadRideLog,
  onSaveRideLogAsRoute,
  onClearRideLogRoute,
  onModeChange,
  onReferenceRoute,
  onGpxImport,
  onFetchElevation,
  onDemoStart,
  onShare,
  isSpotMode,
  onToggleSpotMode,
  onReorderRoutes,
}: BottomPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = savedRoutes.findIndex((r) => r.id === active.id);
    const newIndex = savedRoutes.findIndex((r) => r.id === over.id);
    const reordered = arrayMove([...savedRoutes], oldIndex, newIndex);
    onReorderRoutes?.(reordered);
  }, [savedRoutes, onReorderRoutes]);

  const [showHistory, setShowHistory] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [historyTab, setHistoryTab] = useState<'routes' | 'spots' | 'logs'>('routes');
  const [rideLogs, setRideLogs] = useState<RideLog[]>([]);
  const [showDataMenu, setShowDataMenu] = useState(false);
  const [showGpxMenu, setShowGpxMenu] = useState(false);
  const [showShareExpand, setShowShareExpand] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [routeName, setRouteName] = useState('');

  // 外部から保存シートを開く（インポート完了後など）
  const prevOpenSaveSheet = useRef(false);
  useEffect(() => {
    if (openSaveSheet && !prevOpenSaveSheet.current) {
      setRouteName('');
      setShowSaveSheet(true);
    }
    prevOpenSaveSheet.current = !!openSaveSheet;
  }, [openSaveSheet]);

  const generateShareUrl = async (): Promise<string> => {
    const segPoints = segments.flatMap((s) => s.geometry);
    const allPoints = segPoints.length >= 2 ? segPoints : waypoints;
    if (allPoints.length < 2) throw new Error('ルートを引いてからシェアしてください');
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: allPoints, distance: totalDistance, spots, elevations }),
    });
    const data = await res.json();
    return `${window.location.origin}/?share=${data.id}`;
  };

  const handleShare = async () => {
    try {
      const shareUrl = await generateShareUrl();
      if (navigator.share) {
        navigator.share({ url: shareUrl, title: 'RideOnルート' });
      } else {
        navigator.clipboard.writeText(shareUrl);
        alert('URLをコピーしました');
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'シェアに失敗しました');
    }
  };

  const handleCopyUrl = async () => {
    try {
      const url = await generateShareUrl();
      navigator.clipboard.writeText(url);
      alert('URLをコピーしました');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'シェアに失敗しました');
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

  useEffect(() => {
    if (!showHistory) return;
    try {
      const raw = localStorage.getItem(RIDE_LOG_KEY);
      if (raw) setRideLogs(JSON.parse(raw) as RideLog[]);
    } catch { /* ignore */ }
  }, [showHistory]);

  const handleDeleteLog = useCallback((id: string) => {
    setRideLogs((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      localStorage.setItem(RIDE_LOG_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleUrlImport = async () => {
    const input = urlInput.trim();
    if (!input || urlLoading) return;
    setUrlError('');

    if (input.includes('share=')) {
      // シェアURL
      let shareId: string | null = null;
      try {
        shareId = new URL(input).searchParams.get('share');
      } catch {
        const m = input.match(/share=([a-zA-Z0-9]+)/);
        shareId = m ? m[1] : null;
      }
      if (!shareId) { setUrlError('シェアIDが見つかりません'); return; }
      onLoadRouteFromUrl?.(shareId);
      setUrlInput('');
      setShowUrlInput(false);
      setShowHistory(false);
    } else if (input.includes('mapion.co.jp')) {
      // キョリ測URL
      setUrlLoading(true);
      try {
        const res = await fetch(`/api/kyorisoku?url=${encodeURIComponent(input)}`);
        const data = await res.json() as { points?: { lat: number; lng: number }[]; distance?: number; error?: string };
        if (!res.ok) { setUrlError(data.error ?? '取得に失敗しました'); return; }
        if (!data.points || data.points.length < 2) { setUrlError('座標データが不足しています'); return; }
        onKyorisokuImport?.(data.points, data.distance ?? 0);
        setUrlInput('');
        setShowUrlInput(false);
        setShowHistory(false);
      } catch {
        setUrlError('ネットワークエラーが発生しました');
      } finally {
        setUrlLoading(false);
      }
    } else {
      setUrlError('対応していないURLです');
    }
  };

  const handleGpxImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const xml = new DOMParser().parseFromString(text, 'application/xml');
      const pts = xml.querySelectorAll('trkpt, rtept');
      const points: { lat: number; lng: number }[] = [];
      pts.forEach((pt) => {
        const lat = parseFloat(pt.getAttribute('lat') ?? '');
        const lng = parseFloat(pt.getAttribute('lon') ?? '');
        if (isFinite(lat) && isFinite(lng)) points.push({ lat, lng });
      });
      if (points.length < 2) { alert('GPXファイルにルートデータが見つかりません'); return; }
      onGpxImport?.(points);
      onFetchElevation?.(points);
      setShowDataMenu(false);
      setShowHistory(false);
    };
    reader.readAsText(file);
  };

  const handleGpxExport = () => {
    const allPoints = segments.flatMap((s) => s.geometry);
    const points = allPoints.length >= 2 ? allPoints : waypoints;
    if (points.length < 2) { alert('ルートを引いてからエクスポートしてください'); return; }
    const trkpts = points.map((p) => `      <trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>`).join('\n');
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="RideOn">\n  <trk>\n    <name>RideOnルート</name>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>\n</gpx>`;
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rideon-route-${new Date().toISOString().slice(0, 10)}.gpx`;
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
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
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
          <button
            onClick={() => waypoints.length >= 2 && onReverseRoute?.()}
            disabled={waypoints.length < 2}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors bg-[var(--surface2)] text-[var(--text-muted)] hover:text-[var(--text)] active:bg-[var(--border)] disabled:opacity-50"
          >
            <span className="flex items-center justify-center gap-1">
              {REVERSE_BUTTON.icon}
              {REVERSE_BUTTON.label}
            </span>
          </button>
          <button
            onClick={() => onToggleSpotMode?.()}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${isSpotMode ? 'bg-[#D4AF37] text-white' : 'bg-[var(--surface2)] text-[var(--text-muted)] hover:text-[var(--text)] active:bg-[var(--border)]'}`}
          >
            <span className="flex items-center justify-center gap-1">
              <MapPin size={14} color={isSpotMode ? '#fff' : '#666'} />スポット
            </span>
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-sm px-4 mb-2">
          <span className="text-[var(--text)] font-semibold tabular-nums">
            {formatDistance(totalDistance)}
          </span>
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
        <div className="flex" style={{ maxWidth: '480px', margin: '0 auto', paddingLeft: 'calc(16px + env(safe-area-inset-left))', paddingRight: 'calc(16px + env(safe-area-inset-right))' }}>
          {[
            {
              icon: <Undo2 size={24} />,
              label: '戻す',
              onClick: onUndo,
              disabled: waypoints.length === 0,
            },
            {
              icon: <Trash2 size={24} />,
              label: 'クリア',
              onClick: onClear,
              disabled: waypoints.length === 0,
            },
            {
              icon: <Save size={24} />,
              label: '保存',
              onClick: () => { setRouteName(''); setShowSaveSheet(true); },
              disabled: waypoints.length < 2,
            },
            {
              icon: <Flag size={24} />,
              label: 'マイルート',
              onClick: () => { setShowHistory(true); setResetKey((k) => k + 1); },
              disabled: false,
            },
            {
              icon: <Share2 size={24} />,
              label: 'シェア',
              onClick: () => setShowShareSheet(true),
              disabled: waypoints.length < 2,
            },
            {
              icon: <Clapperboard size={24} />,
              label: 'デモ',
              onClick: () => onDemoStart?.(),
              disabled: waypoints.length < 2,
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
            {sharedSpots.length > 0 && (
              <button
                onClick={() => { onSaveSharedSpots?.(sharedSpots); }}
                style={{ display: 'block', width: '100%', padding: '12px', background: '#f0f8ff', color: '#1a73e8', border: '1.5px solid #1a73e8', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px' }}
              >スポットをマイスポットに追加（{sharedSpots.length}件）</button>
            )}
            <button
              onClick={() => { if (!routeName.trim()) return; onSave(routeName.trim()); setShowSaveSheet(false); setRouteName(''); }}
              disabled={!routeName.trim()}
              style={{ display: 'block', width: '100%', padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', opacity: !routeName.trim() ? 0.4 : 1 }}
            >保存する</button>
          </div>
        </>
      )}

      {/* シェアボトムシート */}
      {showShareSheet && (
        <>
          <div
            onClick={() => setShowShareSheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000 }}
          />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#fff', borderRadius: '16px 16px 0 0', padding: '20px 16px', paddingBottom: 'calc(40px + env(safe-area-inset-bottom))', zIndex: 1001, boxSizing: 'border-box', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>シェア</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowShareSheet(false); handleShare(); }} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px 8px',
                background: 'rgba(212, 175, 55, 0.15)', color: '#D4AF37',
                border: '1px solid #D4AF37', borderRadius: '10px',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              }}>
                <Upload size={16} />
                シェアURLを送る
              </button>
              <button onClick={() => { setShowShareSheet(false); handleCopyUrl(); }} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px 8px',
                background: 'rgba(212, 175, 55, 0.15)', color: '#D4AF37',
                border: '1px solid #D4AF37', borderRadius: '10px',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              }}>
                <Copy size={16} />
                URLをコピー
              </button>
            </div>
          </div>
        </>
      )}

      {/* History modal */}
      {showHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#ffffff', zIndex: 2000, display: 'flex', flexDirection: 'column', maxWidth: '480px', width: '100%', margin: '0 auto', boxSizing: 'border-box' } as React.CSSProperties}>
          {/* Header */}
          <div style={{ flexShrink: 0, padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--text)' }}>マイルート</h2>
            <button style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }} onClick={() => setShowHistory(false)}>✕</button>
          </div>
          {/* Tabs */}
          <div style={{ flexShrink: 0, display: 'flex', gap: '0', padding: '0 16px 0', marginBottom: '8px' }}>
            {([['routes', 'ルート'], ['spots', 'スポット'], ['logs', '走行記録']] as const).map(([t, label]) => (
              <button key={t} onClick={() => setHistoryTab(t)} style={{ flex: 1, padding: '8px 0', fontSize: '12px', fontWeight: '600', background: 'none', border: 'none', borderBottom: historyTab === t ? '2px solid #D4AF37' : '2px solid #eee', color: historyTab === t ? '#D4AF37' : '#999', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Action buttons — routes tab only */}
          {historyTab === 'routes' && (() => {
            const btnStyle: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 4px', background: '#f5f5f5', border: '1px solid #eee', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', color: '#333' };
            const subBtnStyle: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 4px', background: '#f5f5f5', border: '1px solid #eee', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', color: '#333' };
            return (
              <div style={{ flexShrink: 0, padding: '0 16px 12px', borderBottom: '2px solid #D4AF37' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setShowShareExpand((prev) => !prev); setShowGpxMenu(false); setShowDataMenu(false); }} style={btnStyle}>
                    <Share2 size={20} color="#D4AF37" /><span>シェア</span>
                  </button>
                  <button onClick={() => { setShowGpxMenu((prev) => !prev); setShowShareExpand(false); setShowDataMenu(false); }} style={btnStyle}>
                    <Map size={20} color="#D4AF37" /><span>GPX</span>
                  </button>
                  <button onClick={() => { setShowDataMenu((prev) => !prev); setShowShareExpand(false); setShowGpxMenu(false); }} style={btnStyle}>
                    <Database size={20} color="#D4AF37" /><span>データ</span>
                  </button>
                </div>
                {showShareExpand && (
                  <>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', marginTop: '8px' }}>
                    <button onClick={() => { onShare ? onShare() : handleShare(); setShowShareExpand(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, padding: '10px 14px', background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box' as const }}>
                      <Upload size={16} />シェアURLを送る
                    </button>
                    <button onClick={async () => {
                      try {
                        const url = await generateShareUrl();
                        navigator.clipboard.writeText(url);
                        alert('URLをコピーしました');
                      } catch (e: unknown) {
                        alert(e instanceof Error ? e.message : 'シェアに失敗しました');
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, padding: '10px 14px', background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box' as const }}>
                      <Copy size={18} />URLをコピー
                    </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <input
                        type="url"
                        placeholder="シェアURLを貼り付け"
                        value={urlInput}
                        onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
                        style={{ flex: 1, padding: '10px 12px', fontSize: '15px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box', minWidth: 0, WebkitAppearance: 'none' } as React.CSSProperties}
                      />
                      <button onClick={handleUrlImport} disabled={!urlInput.trim() || urlLoading} style={{ padding: '10px 14px', background: '#D4AF37', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', opacity: !urlInput.trim() || urlLoading ? 0.4 : 1 }}>
                        {urlLoading ? '取得中' : '読み込み'}
                      </button>
                    </div>
                    {urlError && <p style={{ fontSize: '12px', color: '#E53935', margin: '4px 0 0' }}>{urlError}</p>}
                  </>
                )}
                {showGpxMenu && (
                  <>
                    <p style={{ fontSize: '11px', color: '#888', margin: '8px 0 4px' }}>外部アプリとのルート共有</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <label style={{ ...subBtnStyle, cursor: 'pointer' }}>
                        <FileInput size={20} color="#D4AF37" /><span>GPX読み込み</span>
                        <input type="file" accept=".gpx" onChange={handleGpxImport} style={{ display: 'none' }} />
                      </label>
                      <button onClick={() => { handleGpxExport(); }} style={subBtnStyle}>
                        <FileOutput size={20} color="#D4AF37" /><span>GPX書き出し</span>
                      </button>
                    </div>
                  </>
                )}
                {showDataMenu && (
                  <>
                    <p style={{ fontSize: '11px', color: '#888', margin: '8px 0 4px' }}>機種変更時のマイルート引き継ぎ</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <label style={subBtnStyle}>
                        <Download size={20} color="#D4AF37" /><span>マイルート読み込み</span>
                        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
                      </label>
                      <button onClick={handleExport} disabled={savedRoutes.length === 0} style={{ ...subBtnStyle, opacity: savedRoutes.length === 0 ? 0.4 : 1 }}>
                        <Upload size={20} color="#D4AF37" /><span>マイルート書き出し</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Route list */}
          {historyTab === 'routes' && (
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box' } as React.CSSProperties}>
              {savedRoutes.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 16px' }}>
                  保存済みルートはありません
                </p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={savedRoutes.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                    {[...savedRoutes].reverse().map((route) => (
                      <SortableRouteItem
                        key={route.id + resetKey}
                        route={route}
                        isSelected={route.id === selectedRouteId}
                        showMyRoute={showHistory}
                        onLoad={() => { onLoadRoute(route); setShowHistory(false); }}
                        onDelete={() => onDeleteRoute(route.id)}
                        onRename={(newName) => onRenameRoute(route.id, newName)}
                        onReference={() => { onReferenceRoute?.(route); setShowHistory(false); }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
              <div style={{ height: 'calc(20px + env(safe-area-inset-bottom))' }} />
            </div>
          )}

          {/* Spot list */}
          {historyTab === 'spots' && (
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px', boxSizing: 'border-box' } as React.CSSProperties}>
              {spots.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 16px' }}>
                  スポットはありません<br />
                  <span style={{ fontSize: '12px' }}>地図を長押しして追加</span>
                </p>
              ) : (
                [...spots].reverse().map((spot) => {
                  const cat = SPOT_CATEGORIES.find((c) => c.id === spot.category);
                  return (
                    <div key={spot.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #eee' }}>
                      <div style={{ flexShrink: 0 }}><SpotIcon category={spot.category} size={22} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{spot.name}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{cat?.label ?? spot.category}</p>
                      </div>
                      <button onClick={() => onDeleteSpot?.(spot.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', flexShrink: 0 }}><Trash2 size={16} /></button>
                    </div>
                  );
                })
              )}
              <div style={{ height: 'calc(20px + env(safe-area-inset-bottom))' }} />
            </div>
          )}

          {/* Ride log list */}
          {historyTab === 'logs' && (
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px', boxSizing: 'border-box' } as React.CSSProperties}>
              {rideLogs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 16px' }}>
                  走行記録はありません
                </p>
              ) : (
                [...rideLogs].reverse().map((log) => (
                  <SwipeableLogItem
                    key={log.id}
                    log={log}
                    isSelected={selectedLogId === log.id}
                    onDelete={() => { handleDeleteLog(log.id); if (selectedLogId === log.id) { setSelectedLogId(null); onClearRideLogRoute?.(); } }}
                    onShowRoute={() => { onLoadRideLog?.(log); onModeChange?.('route'); setShowHistory(false); setSelectedLogId(log.id); }}
                    onSaveAsRoute={() => { onSaveRideLogAsRoute?.(log); setSelectedLogId(null); }}
                    onClearRoute={() => { setSelectedLogId(null); onClearRideLogRoute?.(); }}
                  />
                ))
              )}
              <div style={{ height: 'calc(20px + env(safe-area-inset-bottom))' }} />
            </div>
          )}
        </div>
      )}

    </>
  );
}
