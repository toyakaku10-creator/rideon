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

export interface RideLog {
  id: string;
  date: string; // ISO形式
  distance: number; // km
  duration: number; // 秒
  avgSpeed: number; // km/h
  maxSpeed: number; // km/h
  routeName?: string;
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
