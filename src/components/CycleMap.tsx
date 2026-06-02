'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  GoogleMap,
  Marker,
  Polyline,
  Circle,
  useJsApiLoader,
  type Libraries,
} from '@react-google-maps/api';
import type { Tab, LatLng, RouteSegment } from '@/types';

const LIBRARIES: Libraries = ['geometry'];

const darkMapStyles: google.maps.MapTypeStyle[] = [];

const POLYLINE_COLOR = '#FFB300';

const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 35.6762, lng: 139.6503 };

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  gestureHandling: 'greedy',
  clickableIcons: false,
};

interface CycleMapProps {
  tab: Tab;
  waypoints: LatLng[];
  segments: RouteSegment[];
  currentPosition: LatLng | null;
  center: LatLng | null;
  follow: boolean;
  onMapClick: (latlng: LatLng) => void;
  fitBoundsPoints?: LatLng[] | null;
  onStartPointDragged?: (deltaLat: number, deltaLng: number) => void;
}

export default function CycleMap({
  tab,
  waypoints,
  segments,
  currentPosition,
  center,
  follow,
  onMapClick,
  fitBoundsPoints,
  onStartPointDragged,
}: CycleMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries: LIBRARIES,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const initializedRef = useRef(false);

  const handleLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
  }, []);

  const handleUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // fitBounds when import data arrives
  useEffect(() => {
    if (!map || !fitBoundsPoints || fitBoundsPoints.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    fitBoundsPoints.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 50);
    initializedRef.current = true; // prevent subsequent center effect from overriding
  }, [map, fitBoundsPoints]);

  // Center / follow logic (mirrors Leaflet MapController behaviour)
  useEffect(() => {
    if (!map || !center) return;
    if (!initializedRef.current) {
      map.setCenter({ lat: center.lat, lng: center.lng });
      map.setZoom(15);
      initializedRef.current = true;
    } else if (follow) {
      map.panTo({ lat: center.lat, lng: center.lng });
    }
  }, [map, center, follow]);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (tab !== 'distance' || !e.latLng) return;
      onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    },
    [tab, onMapClick]
  );

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--surface)] text-[var(--red)] text-sm px-6 text-center">
        地図の読み込みに失敗しました。APIキーを確認してください。
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--surface)]">
        <span className="text-[var(--accent)] text-sm animate-pulse">地図を読み込み中…</span>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={DEFAULT_CENTER}
      zoom={13}
      options={{ ...MAP_OPTIONS, styles: darkMapStyles }}
      onClick={handleMapClick}
      onLoad={handleLoad}
      onUnmount={handleUnmount}
    >
      {/* Route polylines */}
      {segments.map((seg, i) => (
        <Polyline
          key={i}
          path={seg.geometry.map((p) => ({ lat: p.lat, lng: p.lng }))}
          options={{
            strokeColor: POLYLINE_COLOR,
            strokeWeight: tab === 'distance' ? 4 : 3,
            strokeOpacity: tab === 'distance' ? 0.85 : 0.5,
          }}
        />
      ))}

      {/* Waypoint markers — first is green (start), rest are yellow-green */}
      {tab === 'distance' &&
        waypoints.map((wp, i) => (
          <Marker
            key={`wp-${i}`}
            position={{ lat: wp.lat, lng: wp.lng }}
            draggable={i === 0 && !!onStartPointDragged}
            onDragEnd={
              i === 0 && onStartPointDragged
                ? (e) => {
                    if (e.latLng) {
                      onStartPointDragged(
                        e.latLng.lat() - wp.lat,
                        e.latLng.lng() - wp.lng
                      );
                    }
                  }
                : undefined
            }
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: i === 0 ? 8 : 6,
              fillColor: i === 0 ? '#00c853' : '#c8f55a',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
        ))}

      {/* Current position circle (speed mode) */}
      {tab === 'speed' && currentPosition && (
        <Circle
          center={{ lat: currentPosition.lat, lng: currentPosition.lng }}
          radius={15}
          options={{
            fillColor: '#4090ff',
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2.5,
            strokeOpacity: 1,
            zIndex: 10,
          }}
        />
      )}
    </GoogleMap>
  );
}
