import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; OpenStreetMap contributors';
export const LAOS_CENTER: [number, number] = [18.2, 103.9];

export interface MapPoint { id: string; lat: number; lng: number; color: string; label: string; sub?: string }

function FitTo({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), { padding: [24, 24], maxZoom: 12 });
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 13);
  }, [points.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function PharmacyMap({ points, onSelect, height = 420, ring }: { points: MapPoint[]; onSelect?: (id: string) => void; height?: number; ring: string }) {
  return (
    <MapContainer center={LAOS_CENTER} zoom={6} style={{ height }} scrollWheelZoom={false}>
      <TileLayer url={TILE} attribution={ATTR} />
      <FitTo points={points} />
      {points.map((p) => (
        <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={7} pathOptions={{ color: ring, weight: 2, fillColor: p.color, fillOpacity: 0.95 }}
          eventHandlers={{ click: () => onSelect?.(p.id) }}>
          <Tooltip direction="top" offset={[0, -6]}><b>{p.label}</b>{p.sub && <><br />{p.sub}</>}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

export function MiniMap({ lat, lng, height = 200 }: { lat: number; lng: number; height?: number }) {
  return (
    <MapContainer center={[lat, lng]} zoom={14} style={{ height, borderRadius: 0 }} scrollWheelZoom={false} zoomControl={false}>
      <TileLayer url={TILE} attribution={ATTR} />
      <CircleMarker center={[lat, lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#0F766E', fillOpacity: 1 }} />
    </MapContainer>
  );
}

function Clicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)) });
  return null;
}
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], Math.max(map.getZoom(), 12)); }, [lat, lng, map]);
  return null;
}

export function PickerMap({ lat, lng, onPick, height = 320 }: { lat: number; lng: number; onPick: (lat: number, lng: number) => void; height?: number }) {
  return (
    <MapContainer center={[lat, lng]} zoom={12} style={{ height }} scrollWheelZoom={false}>
      <TileLayer url={TILE} attribution={ATTR} />
      <Clicker onPick={onPick} />
      <Recenter lat={lat} lng={lng} />
      <CircleMarker center={[lat, lng]} radius={10} pathOptions={{ color: '#fff', weight: 3, fillColor: '#DC2626', fillOpacity: 1 }} />
    </MapContainer>
  );
}
