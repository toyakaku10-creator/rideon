'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  GoogleMap,
  Marker,
  Polyline,
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

function makePositionIcon(heading: number | null): google.maps.Icon {
  const hasHeading = heading != null && !isNaN(heading);
  if (hasHeading) {
    // Triangle (top, 8px) + 1px gap + Wheel (18px) = total height 27px, width 18px
    // Wheel center at (9, 18); rotate everything around wheel center
    const W = 18, H = 27;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <g transform="rotate(${heading}, 9, 18)">
        <polygon points="9,0 4,8 14,8" fill="#4285F4"/>
        <circle cx="9" cy="18" r="8" fill="rgba(66,133,244,0.35)" stroke="#4285F4" stroke-width="2"/>
        <circle cx="9" cy="18" r="2" fill="rgba(66,133,244,0.35)" stroke="#4285F4" stroke-width="1.5"/>
        <line x1="9" y1="11" x2="9" y2="16" stroke="#4285F4" stroke-width="1.5"/>
        <line x1="9" y1="20" x2="9" y2="25" stroke="#4285F4" stroke-width="1.5"/>
        <line x1="2" y1="18" x2="7" y2="18" stroke="#4285F4" stroke-width="1.5"/>
        <line x1="11" y1="18" x2="16" y2="18" stroke="#4285F4" stroke-width="1.5"/>
      </g>
    </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(W, H),
      anchor: new google.maps.Point(9, 18),
    };
  } else {
    const size = 18;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="rgba(66,133,244,0.35)" stroke="#4285F4" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="10" stroke-width="3"/>
      <circle cx="12" cy="12" r="3"/>
      <line x1="12" y1="2" x2="12" y2="9"/>
      <line x1="12" y1="15" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="9" y2="12"/>
      <line x1="15" y1="12" x2="22" y2="12"/>
    </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(size, size),
      anchor: new google.maps.Point(size / 2, size / 2),
    };
  }
}

function makeElevationMarkerIcon(distanceLabel?: string): google.maps.Icon {
  if (distanceLabel) {
    const W = 56, labelH = 18, gap = 2, dotR = 5;
    const dotY = labelH + gap + dotR;
    const H = dotY + dotR;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect x="0" y="0" width="${W}" height="${labelH}" rx="8" fill="#D4AF37"/>
      <text x="${W / 2}" y="${labelH - 4}" text-anchor="middle" fill="#000" font-size="11" font-weight="700" font-family="sans-serif">${distanceLabel}</text>
      <circle cx="${W / 2}" cy="${dotY}" r="${dotR}" fill="#D4AF37" stroke="white" stroke-width="2"/>
    </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(W, H),
      anchor: new google.maps.Point(W / 2, dotY),
    };
  }
  const size = 14;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="#D4AF37" stroke="white" stroke-width="2"/>
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
  rideMode?: boolean;
  heading?: number | null;
  elevationMarkerPos?: LatLng;
  elevationMarkerDistance?: string;
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
  rideMode,
  heading = null,
  elevationMarkerPos,
  elevationMarkerDistance,
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
    map.fitBounds(bounds, { top: 60, bottom: 100, left: 20, right: 20 });
    initializedRef.current = true; // prevent subsequent center effect from overriding
  }, [map, fitBoundsPoints]);

  // Zoom in when switching to ride mode
  useEffect(() => {
    if (!map || !rideMode) return;
    map.setZoom(15.5);
  }, [map, rideMode]);

  // Center / follow logic (mirrors Leaflet MapController behaviour)
  useEffect(() => {
    if (!map || !center) return;
    if (!initializedRef.current) {
      map.setCenter({ lat: center.lat, lng: center.lng });
      map.setZoom(15);
      initializedRef.current = true;
    } else if (follow) {
      map.setCenter({ lat: center.lat, lng: center.lng });
      map.panBy(0, 30);
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
                zIndex: i * 2,
              }}
            />
            <Polyline
              path={path}
              options={{
                strokeColor: POLYLINE_COLOR,
                strokeWeight: 4,
                strokeOpacity: 1,
                zIndex: i * 2 + 1,
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

      {/* Elevation scrub marker */}
      {elevationMarkerPos && (
        <Marker
          position={{ lat: elevationMarkerPos.lat, lng: elevationMarkerPos.lng }}
          icon={makeElevationMarkerIcon(elevationMarkerDistance)}
          zIndex={8}
        />
      )}

      {/* Current position marker (speed mode) */}
      {tab === 'speed' && currentPosition && (
        <Marker
          position={{ lat: currentPosition.lat, lng: currentPosition.lng }}
          icon={makePositionIcon(heading)}
          zIndex={10}
        />
      )}
    </GoogleMap>
  );
}
