'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Bike } from 'lucide-react';
import type { Tab, RouteType, LatLng, RouteSegment, SavedRoute } from '@/types';
import { decodeRoute } from '@/lib/routeShare';
import BottomPanel from '@/components/BottomPanel';
import SpeedPanel from '@/components/SpeedPanel';

// react-leaflet must not run on the server
const CycleMap = dynamic(() => import('@/components/CycleMap'), { ssr: false });

const STORAGE_KEY = 'cycle-map-routes';

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

async function fetchOSRMRoute(
  from: LatLng,
  to: LatLng,
  mode: 'cycling' | 'walking'
): Promise<{ geometry: LatLng[]; distance: number }> {
  const url = `https://router.project-osrm.org/route/v1/${mode}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  const route = data.routes[0];
  const coords: [number, number][] = route.geometry.coordinates;
  return {
    geometry: coords.map(([lng, lat]) => ({ lat, lng })),
    distance: route.distance,
  };
}

function makeStraightSegment(from: LatLng, to: LatLng): RouteSegment {
  return { from, to, geometry: [from, to], distance: haversineDistance(from, to) };
}


export default function Home() {
  const [tab, setTab] = useState<Tab>('distance');

  // Distance measurement
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [routeType, setRouteType] = useState<RouteType>('cycling');
  const [isLoading, setIsLoading] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [fitBoundsPoints, setFitBoundsPoints] = useState<LatLng[] | null>(null);
  const [isImported, setIsImported] = useState(false);

  // Positioning
  const [initialCenter, setInitialCenter] = useState<LatLng | null>(null);
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);

  // Speed stats
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [speedSum, setSpeedSum] = useState(0);
  const [speedCount, setSpeedCount] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // Center map on device location at startup
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInitialCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.warn('getCurrentPosition:', err),
      { enableHighAccuracy: true }
    );
  }, []);

  // Load saved routes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedRoutes(JSON.parse(raw) as SavedRoute[]);
    } catch {
      // ignore corrupt data
    }
  }, []);

  // Restore route from ?route= URL param (shared link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('route');
    if (!encoded) return;
    const result = decodeRoute(encoded);
    if (!result) return;
    setWaypoints(result.waypoints);
    setSegments(result.segments);
    setRouteType(result.routeType);
    if (result.waypoints.length > 0) {
      setInitialCenter(result.waypoints[0]);
    }
  }, []);

  // GPS speed tracking — only active in speed tab
  useEffect(() => {
    if (tab !== 'speed') return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, accuracy } = pos.coords;
        const kmh = speed != null ? speed * 3.6 : 0;
        setCurrentPosition({ lat: latitude, lng: longitude });
        setCurrentSpeed(kmh);
        setGpsAccuracy(accuracy);
        setMaxSpeed((prev) => Math.max(prev, kmh));
        setSpeedSum((prev) => prev + kmh);
        setSpeedCount((prev) => prev + 1);
      },
      (err) => console.warn('watchPosition:', err),
      { enableHighAccuracy: true, maximumAge: 1000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [tab]);

  const totalDistance = segments.reduce((sum, s) => sum + s.distance, 0);
  const avgSpeed = speedCount > 0 ? speedSum / speedCount : 0;

  // Map tap handler — adds waypoint and fetches route segment
  const handleMapClick = useCallback(
    (latlng: LatLng) => {
      if (isLoading) return;

      setWaypoints((prevWps) => {
        const newWps = [...prevWps, latlng];

        if (prevWps.length === 0) return newWps; // first point, no segment yet

        const from = prevWps[prevWps.length - 1];
        const to = latlng;

        if (routeType === 'straight') {
          setSegments((prev) => [...prev, makeStraightSegment(from, to)]);
        } else {
          setIsLoading(true);
          fetchOSRMRoute(from, to, 'cycling')
            .then(({ geometry, distance }) => {
              setSegments((prev) => [...prev, { from, to, geometry, distance }]);
            })
            .catch(() => {
              setSegments((prev) => [...prev, makeStraightSegment(from, to)]);
            })
            .finally(() => setIsLoading(false));
        }

        return newWps;
      });
    },
    [isLoading, routeType]
  );

  const handleRouteTypeChange = useCallback(
    async (type: RouteType) => {
      setRouteType(type);
      if (waypoints.length < 2) return;
      setIsLoading(true);
      try {
        const newSegs: RouteSegment[] = [];
        for (let i = 0; i < waypoints.length - 1; i++) {
          const from = waypoints[i];
          const to = waypoints[i + 1];
          if (type === 'straight') {
            newSegs.push(makeStraightSegment(from, to));
          } else {
            const { geometry, distance } = await fetchOSRMRoute(from, to, 'cycling');
            newSegs.push({ from, to, geometry, distance });
          }
        }
        setSegments(newSegs);
      } catch {
        // keep existing segments on failure
      } finally {
        setIsLoading(false);
      }
    },
    [waypoints]
  );

  const handleUndo = useCallback(() => {
    setWaypoints((prev) => prev.slice(0, -1));
    setSegments((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setWaypoints([]);
    setSegments([]);
  }, []);

  const handleSave = useCallback(
    (name: string) => {
      const route: SavedRoute = {
        id: Date.now().toString(),
        name,
        waypoints,
        routeType,
        segments,
        totalDistance,
        createdAt: new Date().toISOString(),
      };
      const updated = [...savedRoutes, route];
      setSavedRoutes(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setIsImported(false);
    },
    [waypoints, routeType, segments, totalDistance, savedRoutes]
  );

  const handleLoadRoute = useCallback((route: SavedRoute) => {
    setWaypoints(route.waypoints);
    setSegments(route.segments);
    setRouteType(route.routeType);
  }, []);

  const handleDeleteRoute = useCallback(
    (id: string) => {
      const updated = savedRoutes.filter((r) => r.id !== id);
      setSavedRoutes(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },
    [savedRoutes]
  );

  const handleImportUrl = useCallback(async (url: string): Promise<true | string> => {
    try {
      const res = await fetch(`/api/kyorisoku?url=${encodeURIComponent(url)}`);
      const data: unknown = await res.json();

      if (!res.ok) {
        return (data as { error?: string }).error ?? '取得に失敗しました';
      }

      const { points, distance: apiDistance } = data as {
        points: { lat: number; lng: number }[];
        title: string;
        distance: number;
      };

      if (!Array.isArray(points) || points.length < 2) return '座標データが不足しています';

      const latlngs: LatLng[] = points.map((p) => ({ lat: p.lat, lng: p.lng }));

      // API が返す distance (m) を優先、取得できなければ haversine で計算
      const distance =
        apiDistance > 0
          ? apiDistance
          : latlngs.slice(1).reduce((sum, p, i) => sum + haversineDistance(latlngs[i], p), 0);

      const seg: RouteSegment = {
        from: latlngs[0],
        to: latlngs[latlngs.length - 1],
        geometry: latlngs,
        distance,
      };

      setWaypoints([latlngs[0], latlngs[latlngs.length - 1]]);
      setSegments([seg]);
      setFitBoundsPoints([...latlngs]);
      setIsImported(true);
      return true;
    } catch {
      return 'ネットワークエラーが発生しました';
    }
  }, []);

  const handleStartPointDragged = useCallback((deltaLat: number, deltaLng: number) => {
    setWaypoints((prev) => prev.map((wp) => ({ lat: wp.lat + deltaLat, lng: wp.lng + deltaLng })));
    setSegments((prev) =>
      prev.map((seg) => ({
        ...seg,
        from: { lat: seg.from.lat + deltaLat, lng: seg.from.lng + deltaLng },
        to: { lat: seg.to.lat + deltaLat, lng: seg.to.lng + deltaLng },
        geometry: seg.geometry.map((p) => ({ lat: p.lat + deltaLat, lng: p.lng + deltaLng })),
      }))
    );
  }, []);

  const mapCenter =
    tab === 'speed' ? (currentPosition ?? initialCenter) : initialCenter;
  const mapFollow = tab === 'speed' && currentPosition !== null;

  return (
    <div className="flex flex-col bg-[var(--bg)]" style={{ height: '100dvh' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 shrink-0 bg-[var(--surface)] border-b border-[var(--border)]"
        style={{ height: '48px' }}
      >
        <span className="text-[var(--accent)] font-bold text-lg tracking-tight flex items-center gap-1.5">
          <Bike size={20} />
          cycle-map
        </span>
        <div className="flex gap-1">
          {(
            [
              { key: 'distance', label: '距離測定' },
              { key: 'speed', label: '速度' },
            ] as { key: Tab; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative min-h-0">
        <CycleMap
          tab={tab}
          waypoints={waypoints}
          segments={segments}
          currentPosition={currentPosition}
          center={mapCenter}
          follow={mapFollow}
          onMapClick={handleMapClick}
          fitBoundsPoints={fitBoundsPoints}
          onStartPointDragged={handleStartPointDragged}
        />
        {isLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[900] bg-black/50 text-white text-xs px-4 py-1.5 rounded-full pointer-events-none">
            ルート取得中…
          </div>
        )}
      </div>

      {/* Bottom panel */}
      {tab === 'distance' ? (
        <BottomPanel
          waypoints={waypoints}
          segments={segments}
          routeType={routeType}
          totalDistance={totalDistance}
          isLoading={isLoading}
          onRouteTypeChange={handleRouteTypeChange}
          onUndo={handleUndo}
          onClear={handleClear}
          onSave={handleSave}

          savedRoutes={savedRoutes}
          onLoadRoute={handleLoadRoute}
          onDeleteRoute={handleDeleteRoute}
          onImportUrl={handleImportUrl}
          isImported={isImported}
          onImportedSaved={() => setIsImported(false)}
        />
      ) : (
        <SpeedPanel
          currentSpeed={currentSpeed}
          maxSpeed={maxSpeed}
          avgSpeed={avgSpeed}
          gpsAccuracy={gpsAccuracy}
          navDistance={totalDistance}
        />
      )}
    </div>
  );
}
