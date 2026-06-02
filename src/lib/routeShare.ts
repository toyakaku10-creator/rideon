import type { LatLng, RouteSegment, RouteType } from '@/types';

interface Encoded {
  t: RouteType;
  w: [number, number][];
  s: { g: [number, number][]; d: number }[];
}

export function encodeRoute(
  waypoints: LatLng[],
  segments: RouteSegment[],
  routeType: RouteType
): string {
  const data: Encoded = {
    t: routeType,
    w: waypoints.map((p) => [p.lat, p.lng]),
    s: segments.map((seg) => ({
      g: seg.geometry.map((p) => [p.lat, p.lng]),
      d: seg.distance,
    })),
  };
  return btoa(JSON.stringify(data));
}

export function decodeRoute(encoded: string): {
  waypoints: LatLng[];
  segments: RouteSegment[];
  routeType: RouteType;
} | null {
  try {
    const data: Encoded = JSON.parse(atob(encoded));
    const waypoints: LatLng[] = data.w.map(([lat, lng]) => ({ lat, lng }));
    const segments: RouteSegment[] = data.s.map((seg, i) => ({
      from: waypoints[i],
      to: waypoints[i + 1],
      geometry: seg.g.map(([lat, lng]) => ({ lat, lng })),
      distance: seg.d,
      routeType: 'cycling' as const,
    }));
    return { waypoints, segments, routeType: data.t };
  } catch {
    return null;
  }
}
