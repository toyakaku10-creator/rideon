'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
  type Libraries,
} from '@react-google-maps/api';
import type { Tab, LatLng, RouteSegment, Spot } from '@/types';
import { spotLucidePath, spotCustomSvg } from '@/lib/spotCategories';

function getSpotMarkerSizes(zoom: number): { circleSize: number; iconSize: number } {
  if (zoom >= 16) return { circleSize: 28, iconSize: 16 };
  if (zoom >= 14) return { circleSize: 22, iconSize: 13 };
  if (zoom >= 12) return { circleSize: 16, iconSize: 9 };
  return { circleSize: 12, iconSize: 7 };
}

function makeSpotIcon(category: string, name: string, circleSize = 24, iconSize = 14): google.maps.Icon {
  const tailH = 7;
  const labelPad = 6;
  const charW = 6.5;
  const labelW = Math.max(name.length * charW + labelPad * 2, 36);
  const labelH = 16;
  const labelGap = 2;
  const totalW = Math.max(labelW, circleSize);
  const circleX = (totalW - circleSize) / 2;
  const labelX = (totalW - labelW) / 2;
  const circleY = labelH + labelGap;
  const totalH = circleY + circleSize + tailH;
  const iconOffset = (circleSize - iconSize) / 2;

  const customSvg = spotCustomSvg(category);
  let iconG: string;
  if (customSvg) {
    // カスタム SVG: viewBox の幅に合わせてスケール
    const [, , vw] = customSvg.viewBox.split(' ').map(Number);
    const scale = iconSize / vw;
    iconG = `<g transform="translate(${circleX + iconOffset},${circleY + iconOffset}) scale(${scale})" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${customSvg.inner}</g>`;
  } else {
    const path = spotLucidePath(category);
    iconG = `<g transform="translate(${circleX + iconOffset},${circleY + iconOffset}) scale(${iconSize / 24})"><path d="${path}" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}">
    <rect x="${labelX}" y="0" width="${labelW}" height="${labelH}" rx="4" fill="white" stroke="#ddd" stroke-width="1"/>
    <text x="${totalW / 2}" y="${labelH - 4}" text-anchor="middle" font-size="10" font-weight="600" font-family="sans-serif" fill="#333">${name}</text>
    <circle cx="${circleX + circleSize / 2}" cy="${circleY + circleSize / 2}" r="${circleSize / 2 - 1}" fill="#D4AF37" stroke="white" stroke-width="1.5"/>
    ${iconG}
    <polygon points="${circleX + circleSize / 2 - 4},${circleY + circleSize - 1} ${circleX + circleSize / 2 + 4},${circleY + circleSize - 1} ${circleX + circleSize / 2},${totalH - 1}" fill="#D4AF37"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(totalW, totalH),
    anchor: new google.maps.Point(totalW / 2, totalH),
  };
}

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



function makeStartGoalIcon(size = 28): google.maps.Icon {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      <clipPath id="red-clip">
        <polygon points="${cx + 4},0 ${size},0 ${size},${size} ${cx - 4},${size}"/>
      </clipPath>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#4CAF50" stroke="white" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#E53935" clip-path="url(#red-clip)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="2"/>
    <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="${size * 0.4}" font-weight="bold" font-family="sans-serif" fill="white">S/G</text>
  </svg>`;
  return {
    url: 'data:image/svg+xml,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(cx, cy),
  };
}

function makePositionIcon(heading: number | null, gradient = 0): google.maps.Icon {
  const hasHeading = heading != null && !isNaN(heading);
  const abs = Math.abs(gradient);
  const size = 18;

  // 色を勾配で決定: 緑(default) / 黄(2〜8%) / 水玉赤(8%以上)
  let wheelColor = '#4CAF50';
  if (abs >= 8) {
    wheelColor = '#CC0000';
  } else if (abs >= 2) {
    wheelColor = '#FFD700';
  }

  // 急坂（8%以上）: 水玉の丸
  if (abs >= 8) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs><clipPath id="pc"><circle cx="9" cy="9" r="7"/></clipPath></defs>
      <circle cx="9" cy="9" r="8" fill="white" stroke="${wheelColor}" stroke-width="2"/>
      <g clip-path="url(#pc)">
        <circle cx="3" cy="3" r="1.5" fill="${wheelColor}"/>
        <circle cx="9" cy="3" r="1.5" fill="${wheelColor}"/>
        <circle cx="15" cy="3" r="1.5" fill="${wheelColor}"/>
        <circle cx="3" cy="9" r="1.5" fill="${wheelColor}"/>
        <circle cx="9" cy="9" r="1.5" fill="${wheelColor}"/>
        <circle cx="15" cy="9" r="1.5" fill="${wheelColor}"/>
        <circle cx="3" cy="15" r="1.5" fill="${wheelColor}"/>
        <circle cx="9" cy="15" r="1.5" fill="${wheelColor}"/>
        <circle cx="15" cy="15" r="1.5" fill="${wheelColor}"/>
        <circle cx="6" cy="6" r="1.5" fill="${wheelColor}"/>
        <circle cx="12" cy="6" r="1.5" fill="${wheelColor}"/>
        <circle cx="6" cy="12" r="1.5" fill="${wheelColor}"/>
        <circle cx="12" cy="12" r="1.5" fill="${wheelColor}"/>
      </g>
    </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(size, size),
      anchor: new google.maps.Point(size / 2, size / 2),
    };
  }

  if (hasHeading) {
    // 三角＋×スポーク車輪を一体でheading方向に回転
    const S = 34;
    const cx = 17, cy = 17;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
      <g transform="rotate(${heading}, ${cx}, ${cy})">
        <polygon points="${cx},1 ${cx - 5},9 ${cx + 5},9" fill="${wheelColor}"/>
        <circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${wheelColor}" stroke-width="2"/>
        <circle cx="${cx}" cy="${cy}" r="2" fill="none" stroke="${wheelColor}" stroke-width="1.5"/>
        <line x1="11" y1="11" x2="16" y2="16" stroke="${wheelColor}" stroke-width="1.5"/>
        <line x1="18" y1="18" x2="23" y2="23" stroke="${wheelColor}" stroke-width="1.5"/>
        <line x1="23" y1="11" x2="18" y2="16" stroke="${wheelColor}" stroke-width="1.5"/>
        <line x1="16" y1="18" x2="11" y2="23" stroke="${wheelColor}" stroke-width="1.5"/>
        <line x1="17" y1="9" x2="17" y2="15" stroke="${wheelColor}" stroke-width="1.5"/>
        <line x1="17" y1="19" x2="17" y2="25" stroke="${wheelColor}" stroke-width="1.5"/>
        <line x1="9" y1="17" x2="15" y2="17" stroke="${wheelColor}" stroke-width="1.5"/>
        <line x1="19" y1="17" x2="25" y2="17" stroke="${wheelColor}" stroke-width="1.5"/>
      </g>
    </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(S, S),
      anchor: new google.maps.Point(cx, cy),
    };
  } else {
    // ×スポーク車輪（静止）
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${wheelColor}" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="10" stroke-width="3"/>
      <circle cx="12" cy="12" r="3"/>
      <line x1="4" y1="4" x2="9" y2="9"/>
      <line x1="15" y1="15" x2="20" y2="20"/>
      <line x1="20" y1="4" x2="15" y2="9"/>
      <line x1="9" y1="15" x2="4" y2="20"/>
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
  isAdjustingImport?: boolean;
  navSegments?: RouteSegment[];
  rideMode?: boolean;
  isDemoMode?: boolean;
  heading?: number | null;
  elevationMarkerPos?: LatLng;
  elevationMarkerDistance?: string;
  spots?: Spot[];
  onLongPress?: (lat: number, lng: number) => void;
  onSpotClick?: (spot: Spot) => void;
  logTrack?: { lat: number; lng: number }[] | null;
  referenceSegments?: RouteSegment[];
  gradient?: number;
  onMapReady?: (map: google.maps.Map) => void;
  onMarkerReady?: (marker: google.maps.Marker) => void;
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
  isAdjustingImport = false,
  navSegments,
  rideMode,
  isDemoMode = false,
  heading = null,
  elevationMarkerPos,
  elevationMarkerDistance,
  spots = [],
  onLongPress,
  onSpotClick,
  logTrack,
  referenceSegments,
  gradient = 0,
  onMapReady,
  onMarkerReady,
}: CycleMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries: LIBRARIES,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(14);
  const initializedRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressLatLngRef = useRef<{ lat: number; lng: number } | null>(null);
  const longPressActiveRef = useRef(false);

  const handleLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
    onMapReady?.(m);
  }, [onMapReady]);

  const handleUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Track zoom level for responsive spot markers
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('zoom_changed', () => {
      setZoom(map.getZoom() ?? 14);
    });
    return () => google.maps.event.removeListener(listener);
  }, [map]);

  // fitBounds when import data arrives
  useEffect(() => {
    if (!map || !fitBoundsPoints || fitBoundsPoints.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    fitBoundsPoints.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, { top: 60, bottom: 100, left: 20, right: 20 });
    initializedRef.current = true; // prevent subsequent center effect from overriding
  }, [map, fitBoundsPoints]);

  // Zoom in when switching to ride mode (skip in demo mode)
  useEffect(() => {
    if (!map || !rideMode || isDemoMode) return;
    map.setZoom(15);
  }, [map, rideMode, isDemoMode]);

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

  // Long press detection
  useEffect(() => {
    if (!map || !onLongPress) return;
    const downListener = map.addListener('mousedown', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      longPressLatLngRef.current = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      longPressTimerRef.current = setTimeout(() => {
        if (longPressLatLngRef.current) {
          longPressActiveRef.current = true;
          onLongPress(longPressLatLngRef.current.lat, longPressLatLngRef.current.lng);
        }
      }, 1500);
    });
    const cancelLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      longPressLatLngRef.current = null;
    };
    const upListener = map.addListener('mouseup', cancelLongPress);
    const dragListener = map.addListener('drag', cancelLongPress);

    // Touch events for mobile
    const touchStartListener = map.addListener('touchstart', (e: { latLng?: google.maps.LatLng }) => {
      const lat = e.latLng?.lat();
      const lng = e.latLng?.lng();
      if (!lat || !lng) return;
      longPressLatLngRef.current = { lat, lng };
      longPressTimerRef.current = setTimeout(() => {
        longPressActiveRef.current = true;
        onLongPress(lat, lng);
      }, 1500);
    });
    const touchEndListener = map.addListener('touchend', cancelLongPress);
    const touchMoveListener = map.addListener('touchmove', cancelLongPress);

    return () => {
      google.maps.event.removeListener(downListener);
      google.maps.event.removeListener(upListener);
      google.maps.event.removeListener(dragListener);
      google.maps.event.removeListener(touchStartListener);
      google.maps.event.removeListener(touchEndListener);
      google.maps.event.removeListener(touchMoveListener);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, [map, onLongPress]);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (longPressActiveRef.current) {
        longPressActiveRef.current = false;
        return;
      }
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
      {/* Reference route polylines (guide, read-only) */}
      {referenceSegments && referenceSegments.map((seg, i) => (
        <Polyline
          key={`ref-${i}`}
          path={seg.geometry.map((p) => ({ lat: p.lat, lng: p.lng }))}
          options={{
            strokeColor: '#FF0000',
            strokeWeight: 5,
            strokeOpacity: 0.15,
            zIndex: 0,
            clickable: false,
          }}
        />
      ))}

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
                clickable: false,
              }}
            />
            <Polyline
              path={path}
              options={{
                strokeColor: POLYLINE_COLOR,
                strokeWeight: 4,
                strokeOpacity: 1,
                zIndex: i * 2 + 1,
                clickable: false,
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
          const startWp = waypoints[0];
          const goalWp = waypoints[waypoints.length - 1];
          const dLat = (goalWp.lat - startWp.lat) * Math.PI / 180;
          const dLng = (goalWp.lng - startWp.lng) * Math.PI / 180;
          const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 6371000;
          const isNearGoal = waypoints.length > 1 && dist < 200;
          const icon = isStart
            ? (isNearGoal ? makeStartGoalIcon() : makeLabelIcon('S', '#4CAF50'))
            : isGoal
              ? (isNearGoal ? null : makeLabelIcon('G', '#E53935'))
              : makeDotIcon();
          if (icon === null) return null;
          return (
            <Marker
              key={`wp-${i}`}
              position={{ lat: wp.lat, lng: wp.lng }}
              icon={icon}
              zIndex={isStart ? 2 : isGoal ? 1 : 0}
              draggable={isStart && !!onStartPointDragged && isAdjustingImport}
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

      {/* Log track polyline */}
      {logTrack && logTrack.length >= 2 && (
        <Polyline
          path={logTrack.map((p) => ({ lat: p.lat, lng: p.lng }))}
          options={{
            strokeColor: '#FF6D00',
            strokeWeight: 4,
            strokeOpacity: 0.85,
            zIndex: 4,
          }}
        />
      )}

      {/* Elevation scrub marker */}
      {elevationMarkerPos && (
        <Marker
          position={{ lat: elevationMarkerPos.lat, lng: elevationMarkerPos.lng }}
          icon={makeElevationMarkerIcon(elevationMarkerDistance)}
          zIndex={8}
        />
      )}

      {/* Spot markers */}
      {spots.map((spot) => {
        const { circleSize, iconSize } = getSpotMarkerSizes(zoom);
        return (
        <Marker
          key={`${spot.id}-${zoom}`}
          position={{ lat: spot.lat, lng: spot.lng }}
          icon={makeSpotIcon(spot.category, spot.name, circleSize, iconSize)}
          zIndex={5}
          onClick={() => onSpotClick?.(spot)}
        />
        );
      })}

      {/* Current position marker (speed mode) */}
      {tab === 'speed' && currentPosition && (
        <Marker
          position={{ lat: currentPosition.lat, lng: currentPosition.lng }}
          icon={makePositionIcon(heading, gradient)}
          zIndex={10}
          onLoad={(m) => onMarkerReady?.(m)}
        />
      )}
    </GoogleMap>
  );
}
