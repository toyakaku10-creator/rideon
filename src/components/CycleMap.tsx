'use client';

import { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Tab, LatLng, RouteSegment } from '@/types';

// Fix default marker icon paths broken by webpack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const waypointIcon = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;border-radius:50%;background:#c8f55a;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.5)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const positionIcon = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:50%;background:#4090ff;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center"><svg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polygon points=\'3 11 22 2 13 21 11 13 3 11\'/></svg></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapClickHandler({
  onMapClick,
  enabled,
}: {
  onMapClick: (latlng: LatLng) => void;
  enabled: boolean;
}) {
  useMapEvents({
    click(e) {
      if (enabled) onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function MapController({
  center,
  follow,
}: {
  center: LatLng | null;
  follow: boolean;
}) {
  const map = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    if (!center) return;
    if (!initialized.current) {
      map.setView([center.lat, center.lng], 15);
      initialized.current = true;
    } else if (follow) {
      map.panTo([center.lat, center.lng]);
    }
  }, [center, follow, map]);

  return null;
}

interface CycleMapProps {
  tab: Tab;
  waypoints: LatLng[];
  segments: RouteSegment[];
  currentPosition: LatLng | null;
  center: LatLng | null;
  follow: boolean;
  onMapClick: (latlng: LatLng) => void;
}

export default function CycleMap({
  tab,
  waypoints,
  segments,
  currentPosition,
  center,
  follow,
  onMapClick,
}: CycleMapProps) {
  return (
    <MapContainer
      center={[35.6762, 139.6503]}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      className={tab === 'distance' ? 'cursor-crosshair' : ''}
    >
      <TileLayer
        url="https://tile.openstreetmap.jp/styles/osm-bright/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors, &copy; MIERUNE'
      />
      <MapClickHandler onMapClick={onMapClick} enabled={tab === 'distance'} />
      <MapController center={center} follow={follow} />

      {segments.map((seg, i) => (
        <Polyline
          key={i}
          positions={seg.geometry.map((p) => [p.lat, p.lng] as [number, number])}
          color="#c8f55a"
          weight={4}
          opacity={0.85}
        />
      ))}

      {tab === 'distance' &&
        waypoints.map((wp, i) => (
          <Marker
            key={`wp-${i}`}
            position={[wp.lat, wp.lng]}
            icon={waypointIcon}
          />
        ))}

      {tab === 'speed' && currentPosition && (
        <Marker
          position={[currentPosition.lat, currentPosition.lng]}
          icon={positionIcon}
        />
      )}
    </MapContainer>
  );
}
