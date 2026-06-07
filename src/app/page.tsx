'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, Play, Square, Droplets, Mountain, TrendingUp, AlertTriangle, Camera, Utensils, MapPin, type LucideProps } from 'lucide-react';
import type { Tab, RouteType, LatLng, RouteSegment, SavedRoute, RideLog, Spot } from '@/types';
import { SPOT_CATEGORIES, spotCustomSvg } from '@/lib/spotCategories';

const SPOT_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Droplets, Mountain, TrendingUp, AlertTriangle, Camera, Utensils, MapPin,
};
function SpotCatIcon({ iconName, category, size = 16, color = '#D4AF37' }: { iconName: string; category?: string; size?: number; color?: string }) {
  const custom = category ? spotCustomSvg(category) : null;
  if (custom) {
    return (
      <svg viewBox={custom.viewBox} width={size} height={size} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: custom.inner }} />
    );
  }
  const Icon = SPOT_ICON_MAP[iconName] ?? MapPin;
  return <Icon size={size} color={color} />;
}
import { decodeRoute } from '@/lib/routeShare';
import BottomPanel from '@/components/BottomPanel';
import SpeedPanel from '@/components/SpeedPanel';

// react-leaflet must not run on the server
const CycleMap = dynamic(() => import('@/components/CycleMap'), { ssr: false });

const STORAGE_KEY = 'cycle-map-routes';
const RIDE_LOG_KEY = 'rideon-logs';
const SPOT_KEY = 'rideon-spots';

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


function calcRouteHeading(lat: number, lng: number, routePoints: LatLng[]): number | null {
  if (routePoints.length < 2) return null;
  let minDist = Infinity, minIndex = 0;
  routePoints.forEach((p, i) => {
    const d = Math.abs(p.lat - lat) + Math.abs(p.lng - lng);
    if (d < minDist) { minDist = d; minIndex = i; }
  });
  const nextIndex = Math.min(minIndex + 1, routePoints.length - 1);
  if (nextIndex === minIndex) return null;
  const { lat: lat1, lng: lng1 } = routePoints[minIndex];
  const { lat: lat2, lng: lng2 } = routePoints[nextIndex];
  const angle = Math.atan2(lng2 - lng1, lat2 - lat1) * 180 / Math.PI;
  return (angle + 360) % 360;
}

function bearingDeg(a: LatLng, b: LatLng): number {
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function calcHeading(from: [number, number], to: [number, number]): number {
  const dLng = to[1] - from[1];
  const dLat = to[0] - from[0];
  return (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
}

function getWheelSvg(stroke: string, fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10" stroke-width="3"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="4" x2="9" y2="9"/><line x1="15" y1="15" x2="20" y2="20"/><line x1="20" y1="4" x2="15" y2="9"/><line x1="9" y1="15" x2="4" y2="20"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="22"/><line x1="2" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="22" y2="12"/></svg>`;
}

function getHeadingWheelSvg(heading: number, stroke: string, fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><g transform="rotate(${heading}, 17, 17)"><polygon points="17,1 12,9 22,9" fill="${stroke}"/><circle cx="17" cy="17" r="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/><circle cx="17" cy="17" r="2" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><line x1="11" y1="11" x2="16" y2="16" stroke="${stroke}" stroke-width="1.5"/><line x1="18" y1="18" x2="23" y2="23" stroke="${stroke}" stroke-width="1.5"/><line x1="23" y1="11" x2="18" y2="16" stroke="${stroke}" stroke-width="1.5"/><line x1="16" y1="18" x2="11" y2="23" stroke="${stroke}" stroke-width="1.5"/><line x1="17" y1="9" x2="17" y2="15" stroke="${stroke}" stroke-width="1.5"/><line x1="17" y1="19" x2="17" y2="25" stroke="${stroke}" stroke-width="1.5"/><line x1="9" y1="17" x2="15" y2="17" stroke="${stroke}" stroke-width="1.5"/><line x1="19" y1="17" x2="25" y2="17" stroke="${stroke}" stroke-width="1.5"/></g></svg>`;
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
  const [referenceRoute, setReferenceRoute] = useState<SavedRoute | null>(null);
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
  const rideStartTimeRef = useRef<number | null>(null);
  const rideTrackRef = useRef<{ lat: number; lng: number }[]>([]);
  const rideRouteNameRef = useRef<string | undefined>(undefined);
  const [logTrack, setLogTrack] = useState<{ lat: number; lng: number }[] | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const isDemoModeRef = useRef(false);
  const demoRAFRef = useRef<number | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const currentMarkerRef = useRef<google.maps.Marker | null>(null);

  // Spots
  const [spots, setSpots] = useState<Spot[]>([]);
  const [spotDialog, setSpotDialog] = useState<{ lat: number; lng: number } | null>(null);
  const [spotName, setSpotName] = useState('');
  const [spotCategory, setSpotCategory] = useState('pin');
  const [spotDeleteConfirm, setSpotDeleteConfirm] = useState<Spot | null>(null);
  const [sharedSpots, setSharedSpots] = useState<Spot[]>([]);

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

  // Load spots
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SPOT_KEY);
      if (raw) setSpots(JSON.parse(raw) as Spot[]);
    } catch { /* ignore */ }
  }, []);

  // Restore route from ?share=ID (Firestore short URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    const action = params.get('action');
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
        setSharedSpots(Array.isArray(data.spots) ? data.spots : []);

        // action=save の時は自動で保存ダイアログを開く
        if (action === 'save') {
          setTimeout(() => setOpenSaveSheet(true), 1000);
        }
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

  // GPS speed tracking — only active in speed tab (skip in demo mode)
  useEffect(() => {
    if (tab !== 'speed') return;
    if (isDemoModeRef.current) return;
    prevGpsPos.current = null;
    rideTrackRef.current = [];
    setRideDistance(0);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, accuracy, heading: h } = pos.coords;
        const kmh = speed != null ? speed * 3.6 : 0;
        const cur = { lat: latitude, lng: longitude };
        rideTrackRef.current.push(cur);
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

  // Follow current position in GPS speed mode (demo handles its own camera)
  useEffect(() => {
    if (!currentPosition || tab !== 'speed' || isDemoModeRef.current) return;
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setCenter({ lat: currentPosition.lat, lng: currentPosition.lng });
  }, [currentPosition, tab]);

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
    setReferenceRoute(null);
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

  const handleSaveSpot = useCallback(() => {
    if (!spotDialog || !spotName.trim()) return;
    const spot: Spot = {
      id: Date.now().toString(),
      name: spotName.trim(),
      category: spotCategory,
      lat: spotDialog.lat,
      lng: spotDialog.lng,
      createdAt: new Date().toISOString(),
    };
    setSpots((prev) => {
      const updated = [...prev, spot];
      localStorage.setItem(SPOT_KEY, JSON.stringify(updated));
      return updated;
    });
    setSpotDialog(null);
    setSpotName('');
    setSpotCategory('pin');
  }, [spotDialog, spotName, spotCategory]);

  const handleDeleteSpot = useCallback((id: string) => {
    setSpots((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      localStorage.setItem(SPOT_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSaveSharedSpots = useCallback((incoming: Spot[]) => {
    setSpots((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const newSpots = incoming.filter((s) => !existingIds.has(s.id));
      const updated = [...prev, ...newSpots];
      localStorage.setItem(SPOT_KEY, JSON.stringify(updated));
      return updated;
    });
    setSharedSpots([]);
  }, []);


  const handleLoadRoute = useCallback((route: SavedRoute) => {
    setWaypoints(route.waypoints);
    setSegments(route.segments);
    setRouteType(route.routeType);
    rideRouteNameRef.current = route.name;
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


  const handleLoadRouteFromUrl = useCallback(async (shareId: string) => {
    try {
      const res = await fetch(`/api/share?id=${shareId}`);
      const data = await res.json();
      if (!data.points || data.points.length < 2) { alert('ルートが見つかりません'); return; }
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
      setSharedSpots(Array.isArray(data.spots) ? data.spots : []);
      setTimeout(() => setOpenSaveSheet(true), 500);
    } catch {
      alert('ルートの取得に失敗しました');
    }
  }, []);

  const handleKyorisokuImport = useCallback((points: { lat: number; lng: number }[], distance: number) => {
    if (!Array.isArray(points) || points.length < 2) return;
    const latlngs: LatLng[] = points.map((p) => ({ lat: p.lat, lng: p.lng }));
    const dist = distance > 0 ? distance : latlngs.slice(1).reduce((sum, p, i) => sum + haversineDistance(latlngs[i], p), 0);
    const seg: RouteSegment = {
      from: latlngs[0],
      to: latlngs[latlngs.length - 1],
      geometry: latlngs,
      distance: dist,
      routeType: 'straight',
    };
    setWaypoints([latlngs[0], latlngs[latlngs.length - 1]]);
    setSegments([seg]);
    setFitBoundsPoints([...latlngs]);
    setIsImported(true);
    setIsAdjustingImport(true);
    fetch('/api/elevation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: latlngs }),
    })
      .then((r) => r.json())
      .then((data) => { if (data.elevations) setElevations(data.elevations); })
      .catch(() => {});
  }, []);

  const handleGpxImport = useCallback((points: { lat: number; lng: number }[]) => {
    handleKyorisokuImport(points, 0);
  }, [handleKyorisokuImport]);

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

  const startDemoRide = (pts: [number, number][]) => {
    if (pts.length < 2) return;
    isDemoModeRef.current = true;
    setIsDemoMode(true);
    if (currentMarkerRef.current) {
      currentMarkerRef.current.setMap(null);
      currentMarkerRef.current = null;
    }
    // 新しいマーカーを作成
    if (mapInstanceRef.current) {
      const marker = new google.maps.Marker({
        position: { lat: pts[0][0], lng: pts[0][1] },
        map: mapInstanceRef.current,
        icon: {
          url: 'data:image/svg+xml,' + encodeURIComponent(getWheelSvg('#4CAF50', 'rgba(76,175,80,0.35)')),
          anchor: new google.maps.Point(9, 9),
        },
        zIndex: 999,
      });
      currentMarkerRef.current = marker;
    }
    rideTrackRef.current = [];
    rideStartTimeRef.current = Date.now();
    setLogTrack(null);
    setMaxSpeed(0);
    setSpeedSum(0);
    setSpeedCount(0);
    setRideDistance(0);
    prevGpsPos.current = null;
    setTab('speed');

    // 各ポイントの累積距離を計算
    const cumDist: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      const [lat1, lng1] = pts[i - 1];
      const [lat2, lng2] = pts[i];
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const d = Math.sqrt(dLat * dLat + dLng * dLng) * 6371000;
      cumDist.push(cumDist[i - 1] + d);
    }
    const totalDist = cumDist[cumDist.length - 1];
    const demoDurationMs = (totalDist / 16000) * 3600 * 1000 / 100; // 1/100速

    const startTime = performance.now();
    let lastStateUpdate = 0;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed >= demoDurationMs) {
        isDemoModeRef.current = false;
        setIsDemoMode(false);
        setCurrentSpeed(0);
        setTab('distance');
        return;
      }

      // 経過時間から現在の距離を計算
      const progress = elapsed / demoDurationMs;
      const targetDist = totalDist * progress;

      // targetDistに対応するポイントを探す
      let idx = 0;
      for (let i = 1; i < cumDist.length; i++) {
        if (cumDist[i] >= targetDist) { idx = i - 1; break; }
        idx = i;
      }
      const nextIdx = Math.min(idx + 1, pts.length - 1);

      // 2点間を補間
      const segDist = cumDist[nextIdx] - cumDist[idx];
      const t = segDist > 0 ? (targetDist - cumDist[idx]) / segDist : 0;
      const lat = pts[idx][0] + (pts[nextIdx][0] - pts[idx][0]) * t;
      const lng = pts[idx][1] + (pts[nextIdx][1] - pts[idx][1]) * t;
      const pos = { lat, lng };

      // 進行方向を計算してマーカーを更新
      const heading = calcHeading([pts[idx][0], pts[idx][1]], [pts[nextIdx][0], pts[nextIdx][1]]);
      if (currentMarkerRef.current) {
        currentMarkerRef.current.setPosition(pos);
        currentMarkerRef.current.setIcon({
          url: 'data:image/svg+xml,' + encodeURIComponent(getHeadingWheelSvg(heading, '#4CAF50', 'rgba(76,175,80,0.35)')),
          anchor: new google.maps.Point(17, 17),
        });
      }
      mapInstanceRef.current?.setCenter(pos);

      // 速度・走行距離を100msに1回更新
      if (now - lastStateUpdate > 100) {
        setCurrentSpeed(16 + (Math.random() - 0.5) * 2);
        setRideDistance(cumDist[Math.min(idx, cumDist.length - 1)]);
        lastStateUpdate = now;
      }

      demoRAFRef.current = requestAnimationFrame(animate);
    };

    demoRAFRef.current = requestAnimationFrame(animate);
  };

  const stopDemo = () => {
    if (demoRAFRef.current) cancelAnimationFrame(demoRAFRef.current);
    isDemoModeRef.current = false;
    setIsDemoMode(false);
    setCurrentSpeed(0);
    setTab('distance');
  };

  const handleRideButtonPressStart = () => {
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      const pts = segments.flatMap((s) => s.geometry).map((p): [number, number] => [p.lat, p.lng]);
      startDemoRide(pts);
    }, 1500);
  };

  const handleRideButtonPressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const mapCenter =
    tab === 'speed' ? (currentPosition ?? initialCenter) : initialCenter;
  const mapFollow = tab === 'speed' && currentPosition !== null;

  const currentGradient = (() => {
    if (navElevationIndex === null || elevations.length < 3) return 0;
    const i = navElevationIndex;
    const n = elevations.length;
    const range = 5;
    const from = Math.max(0, i - range);
    const to = Math.min(n - 1, i + range);
    if (from === to) return 0;
    const elevDiff = elevations[to] - elevations[from];
    // 対応するルートポイントを使って実距離を計算
    const allPoints = segments.flatMap((s) => s.geometry);
    const m = allPoints.length;
    if (m < 2) return 0;
    const fromPtIdx = Math.round((from / (n - 1)) * (m - 1));
    const toPtIdx = Math.round((to / (n - 1)) * (m - 1));
    let dist = 0;
    for (let k = fromPtIdx; k < toPtIdx; k++) {
      dist += haversineDistance(allPoints[k], allPoints[k + 1]);
    }
    return dist > 0 ? (elevDiff / dist) * 100 : 0;
  })();

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
          heading={(() => {
            if (heading !== null) return heading;
            if (tab === 'speed' && currentPosition && navRoute) {
              const pts = navRoute.segments.flatMap((s) => s.geometry);
              return calcRouteHeading(currentPosition.lat, currentPosition.lng, pts);
            }
            return null;
          })()}
          elevationMarkerPos={elevationMarkerPos}
          elevationMarkerDistance={elevationMarkerDistance}
          gradient={currentGradient}
          spots={[...spots, ...sharedSpots]}
          onLongPress={(lat, lng) => { setSpotDialog({ lat, lng }); setSpotName(''); setSpotCategory('pin'); }}
          onSpotClick={(spot) => { if (spots.some((s) => s.id === spot.id)) setSpotDeleteConfirm(spot); }}
          logTrack={logTrack}
          referenceSegments={referenceRoute?.segments}
          onMapReady={(m) => { mapInstanceRef.current = m; }}
          onMarkerReady={(m) => { currentMarkerRef.current = m; }}
        />


        {/* Floating RideOn button */}
        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 500 }}>
          <button
            onTouchStart={handleRideButtonPressStart}
            onTouchEnd={handleRideButtonPressEnd}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              if (isDemoMode) {
                stopDemo();
                return;
              }
              if (tab === 'speed') {
                // ライドモード終了 → 走行記録を保存
                const endTime = Date.now();
                const duration = rideStartTimeRef.current ? Math.round((endTime - rideStartTimeRef.current) / 1000) : 0;
                const distanceKm = rideDistance / 1000;
                if (distanceKm >= 0.1 && duration > 0) {
                  const log: RideLog = {
                    id: endTime.toString(),
                    date: new Date().toISOString(),
                    distance: distanceKm,
                    duration,
                    avgSpeed: speedCount > 0 ? speedSum / speedCount : 0,
                    maxSpeed,
                    routeName: rideRouteNameRef.current,
                    track: [...rideTrackRef.current],
                  };
                  try {
                    const raw = localStorage.getItem(RIDE_LOG_KEY);
                    const logs: RideLog[] = raw ? JSON.parse(raw) : [];
                    logs.push(log);
                    localStorage.setItem(RIDE_LOG_KEY, JSON.stringify(logs));
                  } catch { /* ignore */ }
                }
                rideStartTimeRef.current = null;
                setTab('distance');
              } else {
                // ライドモード開始
                rideTrackRef.current = [];
                setLogTrack(null);
                rideStartTimeRef.current = Date.now();
                setTab('speed');
              }
            }}
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
              padding: '5px 16px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              backdropFilter: 'blur(4px)',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              minWidth: '110px',
              whiteSpace: 'nowrap',
              justifyContent: 'center',
              transition: 'all 0.2s',
            } as React.CSSProperties}
          >
            {(tab === 'speed' || isDemoMode) ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            RideOn
            <Bike size={18} />
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
          rideDistance={isDemoMode ? rideDistance : undefined}
          onReverseRoute={handleReverseRoute}
          onLoadRouteFromUrl={handleLoadRouteFromUrl}
          onKyorisokuImport={handleKyorisokuImport}
          spots={spots}
          onDeleteSpot={handleDeleteSpot}
          sharedSpots={sharedSpots}
          onSaveSharedSpots={handleSaveSharedSpots}
          onLoadRideLog={(log) => {
            setLogTrack(log.track ?? null);
            setElevations([]);
            if (log.track && log.track.length >= 2) setFitBoundsPoints(log.track);
          }}
          onSaveRideLogAsRoute={(log) => {
            const track = log.track!;
            const latlngs: LatLng[] = track.map((p) => ({ lat: p.lat, lng: p.lng }));
            setWaypoints([latlngs[0], latlngs[latlngs.length - 1]]);
            setSegments([{
              from: latlngs[0],
              to: latlngs[latlngs.length - 1],
              geometry: latlngs,
              distance: log.distance * 1000,
              routeType: 'straight',
            }]);
            setLogTrack(null);
            setTimeout(() => setOpenSaveSheet(true), 100);
          }}
          onClearRideLogRoute={() => {
            setLogTrack(null);
            setWaypoints([]);
            setSegments([]);
          }}
          onModeChange={(mode) => { if (mode === 'route') setTab('distance'); }}
          onReferenceRoute={(route) => {
            setReferenceRoute(route);
            setWaypoints([]);
            setSegments([]);
            const pts = route.segments.flatMap((s) => s.geometry);
            if (pts.length > 0) setFitBoundsPoints(pts);
          }}
          onGpxImport={handleGpxImport}
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

      {/* Spot add dialog */}
      {spotDeleteConfirm && (
        <>
          <div onClick={() => setSpotDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000 }} />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#fff', borderRadius: '16px 16px 0 0', padding: '20px 16px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', zIndex: 2001, boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '600' }}>スポットを削除</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#555' }}>「{spotDeleteConfirm.name}」を削除しますか？</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setSpotDeleteConfirm(null)}
                style={{ flex: 1, padding: '14px', background: '#f0f0f0', color: '#333', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
              >キャンセル</button>
              <button
                onClick={() => { handleDeleteSpot(spotDeleteConfirm.id); setSpotDeleteConfirm(null); }}
                style={{ flex: 1, padding: '14px', background: '#e53935', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
              >削除する</button>
            </div>
          </div>
        </>
      )}

      {spotDialog && (
        <>
          <div onClick={() => setSpotDialog(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000 }} />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#fff', borderRadius: '16px 16px 0 0', padding: '20px 16px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', zIndex: 2001, boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>スポットを追加</h3>
            <input
              type="text"
              placeholder="スポット名"
              value={spotName}
              onChange={(e) => setSpotName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && spotName.trim() && handleSaveSpot()}
              autoFocus
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '10px', marginBottom: '12px', WebkitAppearance: 'none' } as React.CSSProperties}
            />
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {SPOT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSpotCategory(cat.id)}
                  style={{ padding: '6px 12px', borderRadius: '20px', border: `2px solid ${spotCategory === cat.id ? '#D4AF37' : '#ddd'}`, background: spotCategory === cat.id ? '#fff9e6' : '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <SpotCatIcon iconName={cat.icon} category={cat.id} size={15} color={spotCategory === cat.id ? '#D4AF37' : '#999'} />{cat.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleSaveSpot}
              disabled={!spotName.trim()}
              style={{ display: 'block', width: '100%', padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', opacity: !spotName.trim() ? 0.4 : 1 }}
            >保存する</button>
          </div>
        </>
      )}
    </div>
  );
}
