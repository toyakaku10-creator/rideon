export type RouteType = 'straight' | 'cycling' | 'walking';
export type Tab = 'distance' | 'speed';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteSegment {
  from: LatLng;
  to: LatLng;
  geometry: LatLng[];
  distance: number; // meters
  routeType: 'cycling' | 'straight';
}

export interface SavedRoute {
  id: string;
  name: string;
  waypoints: LatLng[];
  routeType: RouteType;
  segments: RouteSegment[];
  totalDistance: number;
  createdAt: string;
  elevations?: number[];
}
