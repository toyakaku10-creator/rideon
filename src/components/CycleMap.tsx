'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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

const POLYLINE_COLOR = '#FF6B00';

function makeLabelIcon(label: string, bg: string, size = 28): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${bg}" stroke="white" stroke-width="2"/>
    <text x="${size / 2}" y="${size / 2 + 5}" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="sans-serif">${label}</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

function makeDotIcon(): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14">
    <circle cx="7" cy="7" r="5" fill="#D4AF37" stroke="white" stroke-width="2"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(14, 14),
    anchor: new google.maps.Point(7, 7),
  };
}

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
  navSegments?: RouteSegment[];
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
  navSegments,
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
      {/* Route polylines — outline then main line for each segment */}
      {segments.map((seg, i) => {
        const path = seg.geometry.map((p) => ({ lat: p.lat, lng: p.lng }));
        return (
          <React.Fragment key={i}>
            <Polyline
              path={path}
              options={{
                strokeColor: '#ffffff',
                strokeWeight: 7,
                strokeOpacity: 0.9,
                zIndex: 1,
              }}
            />
            <Polyline
              path={path}
              options={{
                strokeColor: POLYLINE_COLOR,
                strokeWeight: 4,
                strokeOpacity: 1,
                zIndex: 2,
              }}
            />
          </React.Fragment>
        );
      })}

      {/* Waypoint markers — S (start), G (goal), dot (intermediate) */}
      {tab === 'distance' &&
        waypoints.map((wp, i) => {
          const isStart = i === 0;
          const isGoal = i === waypoints.length - 1 && waypoints.length > 1;
          const icon = isStart
            ? makeLabelIcon('S', '#4CAF50')
            : isGoal
              ? makeLabelIcon('G', '#E53935')
              : makeDotIcon();
          return (
            <Marker
              key={`wp-${i}`}
              position={{ lat: wp.lat, lng: wp.lng }}
              icon={icon}
              draggable={isStart && !!onStartPointDragged}
              onDragEnd={
                isStart && onStartPointDragged
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
            />
          );
        })}

      {/* Nav route polyline (speed mode) */}
      {tab === 'speed' && navSegments && navSegments.map((seg, i) => (
        <Polyline
          key={`nav-${i}`}
          path={seg.geometry.map((p) => ({ lat: p.lat, lng: p.lng }))}
          options={{
            strokeColor: '#4090ff',
            strokeWeight: 3,
            strokeOpacity: 0.7,
            zIndex: 3,
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
