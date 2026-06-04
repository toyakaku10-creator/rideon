'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  return { from, to, geometry: [from, to], distance: haversineDistance(from, to), routeType: 'straight' };
}


function bearingDeg(a: LatLng, b: LatLng): number {
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function angleDiff(a: number, b: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return d; // positive = right, negative = left
}

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('distance');

  // Distance measurement
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [routeType, setRouteType] = useState<RouteType>('cycling');
  const [isLoading, setIsLoading] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [fitBoundsPoints, setFitBoundsPoints] = useState<LatLng[] | null>(null);
  const [isImported, setIsImported] = useState(false);
  const [isAdjustingImport, setIsAdjustingImport] = useState(false);
  const [openSaveSheet, setOpenSaveSheet] = useState(false);

  // Elevation
  const [elevations, setElevations] = useState<number[]>([]);
  const [navElevations, setNavElevations] = useState<number[]>([]);
  const [elevationIndex, setElevationIndex] = useState<number | null>(null);
  const [navElevationIndex, setNavElevationIndex] = useState<number | null>(null);

  // Navigation
  const [navRoute, setNavRoute] = useState<SavedRoute | null>(null);
  const [navInstruction, setNavInstruction] = useState<string>('');

  // Positioning
  const [initialCenter, setInitialCenter] = useState<LatLng | null>(null);
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);

  // Speed stats
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [speedSum, setSpeedSum] = useState(0);
  const [speedCount, setSpeedCount] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [rideDistance, setRideDistance] = useState(0);
  const prevGpsPos = useRef<{ lat: number; lng: number } | null>(null);

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

  // Restore route from ?share=ID (Firestore short URL)
  useEffect(() => {
    const shareId = new URLSearchParams(window.location.search).get('share');
    if (!shareId) return;
    fetch(`/api/share?id=${shareId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.points || data.points.length < 2) return;
        const latlngs: LatLng[] = data.points;
        setSegments([{
          from: latlngs[0],
          to: latlngs[latlngs.length - 1],
          geometry: latlngs,
          distance: data.distance,
          routeType: 'straight',
        }]);
        setWaypoints([latlngs[0], latlngs[latlngs.length - 1]]);
        setFitBoundsPoints(latlngs);
      })
      .catch(() => {});
  }, []);

  // Restore route from ?route= URL param (shared link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('route');
    if (!encoded) return;

    // Try new format: btoa(JSON.stringify({ points, distance }))
    try {
      const json = JSON.parse(decodeURIComponent(escape(atob(encoded))));
      if (json && Array.isArray(json.points) && json.points.length >= 2) {
        const pts: LatLng[] = json.points.map((p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng }));
        const segs: RouteSegment[] = pts.slice(1).map((to, i) => ({
          from: pts[i], to, geometry: [pts[i], to],
          distance: haversineDistance(pts[i], to), routeType: 'straight' as const,
        }));
        setWaypoints(pts);
        setSegments(segs);
        setFitBoundsPoints(pts);
        return;
      }
    } catch { /* fall through to legacy format */ }

    // Legacy format: encodeRoute
    const result = decodeRoute(encoded);
    if (!result) return;
    setWaypoints(result.waypoints);
    setSegments(result.segments);
    setRouteType(result.routeType);
    if (result.waypoints.length > 0) {
      setFitBoundsPoints(result.waypoints);
    }
  }, []);

  // Detect import result from /import page
  useEffect(() => {
    const raw = sessionStorage.getItem('cycle-map-import-result');
    if (!raw) return;
    sessionStorage.removeItem('cycle-map-import-result');
    try {
      const { points, distance: apiDistance } = JSON.parse(raw) as {
        points: { lat: number; lng: number }[];
        distance: number;
      };
      if (!Array.isArray(points) || points.length < 2) return;
      const latlngs: LatLng[] = points.map((p) => ({ lat: p.lat, lng: p.lng }));
      const distance =
        apiDistance > 0
          ? apiDistance
          : latlngs.slice(1).reduce((sum, p, i) => sum + haversineDistance(latlngs[i], p), 0);
      const seg: RouteSegment = {
        from: latlngs[0],
        to: latlngs[latlngs.length - 1],
        geometry: latlngs,
        distance,
        routeType: 'straight',
      };
      setWaypoints([latlngs[0], latlngs[latlngs.length - 1]]);
      setSegments([seg]);
      setFitBoundsPoints([...latlngs]);
      setIsImported(true);
      setIsAdjustingImport(true);

      // 高低差を取得（segmentsのeffectより先に明示的に呼ぶ）
      fetch('/api/elevation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: latlngs }),
      })
        .then((r) => r.json())
        .then((data) => { if (data.elevations) setElevations(data.elevations); })
        .catch(() => {});
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch elevation data whenever segments change
  useEffect(() => {
    const points = segments.flatMap((s) => s.geometry);
    if (points.length < 2) { setElevations([]); return; }
    let cancelled = false;
    fetch('/api/elevation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    })
      .then((r) => r.json())
      .then((data) => {
        console.log('elevation response (segments):', data);
        console.log('elevations length (segments):', data.elevations?.length);
        if (!cancelled && data.elevations) setElevations(data.elevations);
      })
      .catch(() => { /* silent fail */ });
    return () => { cancelled = true; };
  }, [segments]);

  // Fetch elevation data for nav route
  useEffect(() => {
    if (!navRoute) { setNavElevations([]); return; }
    const points = navRoute.segments.flatMap((s) => s.geometry);
    if (points.length < 2) { setNavElevations([]); return; }
    let cancelled = false;
    fetch('/api/elevation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    })
      .then((r) => r.json())
      .then((data) => {
        console.log('elevation response (navRoute):', data);
        console.log('elevations length (navRoute):', data.elevations?.length);
        if (!cancelled && data.elevations) setNavElevations(data.elevations);
      })
      .catch(() => { /* silent fail */ });
    return () => { cancelled = true; };
  }, [navRoute]);

  // Update navElevationIndex when currentPosition changes (ride mode)
  useEffect(() => {
    if (!currentPosition || elevations.length < 2) { setNavElevationIndex(null); return; }
    const allPoints = segments.flatMap((s) => s.geometry);
    if (allPoints.length === 0) { setNavElevationIndex(null); return; }
    // 最近傍ポイントを探す
    let minDist = Infinity, minPtIdx = 0;
    allPoints.forEach((p, i) => {
      const d = Math.abs(p.lat - currentPosition.lat) + Math.abs(p.lng - currentPosition.lng);
      if (d < minDist) { minDist = d; minPtIdx = i; }
    });
    // geometry index → elevation index に変換
    const elevIdx = Math.round(minPtIdx / (allPoints.length - 1) * (elevations.length - 1));
    setNavElevationIndex(elevIdx);
  }, [currentPosition, segments, elevations]);

  // GPS speed tracking — only active in speed tab
  useEffect(() => {
    if (tab !== 'speed') return;
    prevGpsPos.current = null;
    setRideDistance(0);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, accuracy, heading: h } = pos.coords;
        const kmh = speed != null ? speed * 3.6 : 0;
        const cur = { lat: latitude, lng: longitude };
        if (prevGpsPos.current) {
          const d = haversineDistance(prevGpsPos.current, cur);
          setRideDistance((prev) => prev + d);
        }
        prevGpsPos.current = cur;
        setCurrentPosition(cur);
        setCurrentSpeed(kmh);
        setGpsAccuracy(accuracy);
        setHeading(h != null && !isNaN(h) ? h : null);
        if (kmh > 3) {
          setMaxSpeed((prev) => Math.max(prev, kmh));
          setSpeedSum((prev) => prev + kmh);
          setSpeedCount((prev) => prev + 1);
        }
      },
      (err) => console.warn('watchPosition:', err),
      { enableHighAccuracy: true, maximumAge: 1000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [tab]);

  // Navigation turn detection
  useEffect(() => {
    if (!currentPosition || !navRoute) { setNavInstruction(''); return; }
    const pts = navRoute.segments.flatMap(s => s.geometry);
    if (pts.length < 2) return;

    // find closest point index
    let closestIdx = 0, minDist = Infinity;
    pts.forEach((p, i) => {
      const d = haversineDistance(currentPosition, p);
      if (d < minDist) { minDist = d; closestIdx = i; }
    });

    // check if near goal
    const distToGoal = haversineDistance(currentPosition, pts[pts.length - 1]);
    if (distToGoal < 100) { setNavInstruction('まもなくゴール！'); return; }

    // find next turn ahead
    for (let i = closestIdx + 1; i < pts.length - 1; i++) {
      const b1 = bearingDeg(pts[i - 1], pts[i]);
      const b2 = bearingDeg(pts[i], pts[i + 1]);
      const diff = angleDiff(b1, b2);
      if (Math.abs(diff) > 30) {
        const dist = haversineDistance(currentPosition, pts[i]);
        if (dist < 200) {
          const distStr = `${Math.round(dist)}m`;
          setNavInstruction(diff > 0 ? `まもなく右折 (${distStr})` : `まもなく左折 (${distStr})`);
          return;
        }
        break;
      }
    }
    setNavInstruction('');
  }, [currentPosition, navRoute]);

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
          setSegments((prev) => [...prev, { ...makeStraightSegment(from, to), routeType: 'straight' }]);
        } else {
          setIsLoading(true);
          fetchOSRMRoute(from, to, 'cycling')
            .then(({ geometry, distance }) => {
              setSegments((prev) => [...prev, { from, to, geometry, distance, routeType: 'cycling' }]);
            })
            .catch(() => {
              setSegments((prev) => [...prev, { ...makeStraightSegment(from, to), routeType: 'cycling' }]);
            })
            .finally(() => setIsLoading(false));
        }

        return newWps;
      });
    },
    [isLoading, routeType]
  );

  const handleRouteTypeChange = useCallback((type: RouteType) => {
    setRouteType(type);
  }, []);

  const handleUndo = useCallback(() => {
    setWaypoints((prev) => prev.slice(0, -1));
    setSegments((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setWaypoints([]);
    setSegments([]);
  }, []);

  const handleReverseRoute = useCallback(() => {
    setWaypoints((prev) => [...prev].reverse());
    setSegments((prev) => [...prev].reverse().map((s) => ({
      ...s,
      geometry: [...s.geometry].reverse(),
      from: s.to,
      to: s.from,
    })));
    setElevations((prev) => [...prev].reverse());
  }, []);


  const handleLoadRoute = useCallback((route: SavedRoute) => {
    setWaypoints(route.waypoints);
    setSegments(route.segments);
    setRouteType(route.routeType);
    if (route.elevations && route.elevations.length >= 2) {
      setElevations(route.elevations);
    }
    // else: segments change will trigger the elevation fetch effect
    const loadedPoints = route.segments.flatMap((s) => s.geometry);
    if (loadedPoints.length > 0) {
      setFitBoundsPoints(loadedPoints);
    }
  }, []);

  const handleDeleteRoute = useCallback(
    (id: string) => {
      const updated = savedRoutes.filter((r) => r.id !== id);
      setSavedRoutes(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },
    [savedRoutes]
  );

  const handleRenameRoute = useCallback(
    (id: string, newName: string) => {
      const updated = savedRoutes.map((r) => r.id === id ? { ...r, name: newName } : r);
      setSavedRoutes(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },
    [savedRoutes]
  );

  const handleImportRoutes = useCallback(
    (imported: SavedRoute[]) => {
      const existing = new Set(savedRoutes.map((r) => r.id));
      const newRoutes = imported.filter((r) => !existing.has(r.id));
      const updated = [...savedRoutes, ...newRoutes];
      setSavedRoutes(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      alert(`${newRoutes.length}件のルートをインポートしました`);
    },
    [savedRoutes]
  );


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
        elevations: elevations.length >= 2 ? elevations : undefined,
      };
      const updated = [...savedRoutes, route];
      setSavedRoutes(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setIsImported(false);
      setIsAdjustingImport(false);
      setOpenSaveSheet(false);
    },
    [waypoints, routeType, segments, totalDistance, savedRoutes, elevations]
  );

  const handleImportSave = useCallback(async () => {
    if (isImported) {
      const points = segments.flatMap((s) => s.geometry);
      try {
        const res = await fetch('/api/elevation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points }),
        });
        const data = await res.json();
        if (data.elevations) setElevations(data.elevations);
      } catch { /* silent fail */ }
    }
    setOpenSaveSheet(true);
  }, [isImported, segments]);

  const mapCenter =
    tab === 'speed' ? (currentPosition ?? initialCenter) : initialCenter;
  const mapFollow = tab === 'speed' && currentPosition !== null;

  const elevationMarkerPos = (() => {
    if (elevationIndex === null || elevations.length < 2) return undefined;
    const allPoints = segments.flatMap((s) => s.geometry);
    if (allPoints.length === 0) return undefined;
    const ptIndex = Math.round(elevationIndex / (elevations.length - 1) * (allPoints.length - 1));
    return allPoints[Math.min(ptIndex, allPoints.length - 1)];
  })();

  const elevationMarkerDistance = (() => {
    if (elevationIndex === null || elevations.length < 2) return undefined;
    const km = (elevationIndex / (elevations.length - 1)) * totalDistance / 1000;
    return `${km.toFixed(2)}km`;
  })();


  return (
    <div className="flex flex-col bg-[var(--bg)]" style={{ height: '100dvh' }}>
      {/* Map (full screen, header removed) */}
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
          navSegments={navRoute?.segments}
          rideMode={tab === 'speed'}
          heading={heading}
          elevationMarkerPos={elevationMarkerPos}
          elevationMarkerDistance={elevationMarkerDistance}
        />

        {/* Floating RideOn button */}
        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 500 }}>
          <button
            onClick={() => setTab(tab === 'speed' ? 'distance' : 'speed')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: "'Dancing Script', cursive",
              fontSize: '20px',
              fontWeight: 700,
              color: tab === 'speed' ? '#fff' : '#D4AF37',
              background: tab === 'speed' ? '#D4AF37' : 'rgba(255,255,255,0.9)',
              border: '2px solid #D4AF37',
              borderRadius: '20px',
              padding: '5px 14px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              backdropFilter: 'blur(4px)',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            } as React.CSSProperties}
          >
            <Bike size={18} color={tab === 'speed' ? '#fff' : '#D4AF37'} />
            RideOn
          </button>
        </div>

        {tab === 'speed' && navInstruction && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[900] bg-[#D4AF37] text-white text-sm font-bold px-5 py-2 rounded-full shadow-lg pointer-events-none">
            {navInstruction}
          </div>
        )}
        {isLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[900] bg-black/50 text-white text-xs px-4 py-1.5 rounded-full pointer-events-none">
            ルート取得中…
          </div>
        )}
      </div>

      {/* スタート補正バナー（地図とフッターの間） */}
      {isAdjustingImport && (
        <div style={{ background: '#fff9e6', borderTop: '1px solid #D4AF37', borderBottom: '1px solid #D4AF37', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>
            スタート地点をドラッグして補正
          </span>
          <button
            onClick={handleImportSave}
            style={{ background: '#D4AF37', border: 'none', borderRadius: '10px', padding: '6px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
          >完了・保存する</button>
        </div>
      )}

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
          openSaveSheet={openSaveSheet}
          onSaveSheetClose={() => setOpenSaveSheet(false)}
          savedRoutes={savedRoutes}
          onLoadRoute={handleLoadRoute}
          onDeleteRoute={handleDeleteRoute}
          onRenameRoute={handleRenameRoute}
          onImportRoutes={handleImportRoutes}
          onImportClick={() => router.push('/import')}
          isImported={isImported}
          elevations={elevations}
          onElevationPositionChange={setElevationIndex}
          onReverseRoute={handleReverseRoute}
        />
      ) : (
        <SpeedPanel
          currentSpeed={currentSpeed}
          maxSpeed={maxSpeed}
          avgSpeed={avgSpeed}
          gpsAccuracy={gpsAccuracy}
          navDistance={navRoute?.totalDistance ?? 0}
          navRoute={navRoute}
          navElevations={elevations}
          navTotalDistance={totalDistance}
          navElevationIndex={navElevationIndex ?? undefined}
          rideDistance={rideDistance}
        />
      )}
    </div>
  );
}
