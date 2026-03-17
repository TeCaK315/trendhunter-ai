import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/MapLocation.tsx': `'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, ZoomIn, ZoomOut } from 'lucide-react';

interface Marker {
  lat: number;
  lng: number;
  title?: string;
  description?: string;
  color?: string;
}

interface MapLocationProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: Marker[];
  height?: number;
  interactive?: boolean;
}

export default function MapLocation({
  center = { lat: 55.7558, lng: 37.6173 },
  zoom = 12,
  markers = [],
  height = 400,
  interactive = true,
}: MapLocationProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load Leaflet CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    if (!(window as any).L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setLoaded(true);
      document.head.appendChild(script);
    } else {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstance) return;
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      dragging: interactive,
      scrollWheelZoom: interactive,
    }).setView([center.lat, center.lng], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    // Add markers
    markers.forEach(m => {
      const markerIcon = L.divIcon({
        html: '<div style="width:24px;height:24px;border-radius:50%;background:' + (m.color || '${t.primary}') + ';border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([m.lat, m.lng], { icon: markerIcon }).addTo(map);
      if (m.title || m.description) {
        marker.bindPopup(
          '<div style="font-family:sans-serif">' +
          (m.title ? '<strong>' + m.title + '</strong>' : '') +
          (m.description ? '<br><span style="font-size:12px;color:#666">' + m.description + '</span>' : '') +
          '</div>'
        );
      }
    });

    // Center marker if no markers provided
    if (markers.length === 0) {
      const centerIcon = L.divIcon({
        html: '<div style="width:30px;height:30px;border-radius:50%;background:${t.primary};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:50%;background:#fff"></div></div>',
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([center.lat, center.lng], { icon: centerIcon }).addTo(map);
    }

    // Fit bounds if multiple markers
    if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((m: Marker) => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    setMapInstance(map);

    return () => { map.remove(); };
  }, [loaded]);

  return (
    <div className="rounded-2xl border overflow-hidden relative" style={{ borderColor: '${t.primary40}' }}>
      <div ref={mapRef} style={{ height, width: '100%' }} />

      {interactive && mapInstance && (
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1">
          <button onClick={() => mapInstance.zoomIn()}
            className="w-8 h-8 rounded-lg border flex items-center justify-center shadow-sm"
            style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}>
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => mapInstance.zoomOut()}
            className="w-8 h-8 rounded-lg border flex items-center justify-center shadow-sm"
            style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}>
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      )}

      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: '${t.primary10}' }}>
          <div className="text-center">
            <MapPin className="w-8 h-8 mx-auto mb-2 animate-pulse" style={{ color: '${t.primary}' }} />
            <p className="text-xs" style={{ color: '${t.text50}' }}>Загрузка карты...</p>
          </div>
        </div>
      )}
    </div>
  );
}
`,
  };
}
