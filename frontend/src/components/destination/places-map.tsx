"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { MARKER_COLORS, type MapMarker } from "@/components/destination/map-legend";
import type { LatLon } from "@/lib/geo";

/**
 * The destination's places on OpenStreetMap tiles, one colour per section. `focus` flies the map
 * to a place ("View on map"). Leaflet needs `window`, so pages load this with next/dynamic.
 */
export default function PlacesMap({ markers, focus, centre }: { markers: MapMarker[]; focus?: LatLon | null; centre: LatLon }) {
  const points: [number, number][] = markers.length
    ? markers.map((m) => [m.latitude, m.longitude])
    : [[centre.latitude, centre.longitude]];
  return (
    <MapContainer bounds={L.latLngBounds(points).pad(0.1)} scrollWheelZoom={false} className="h-[420px] w-full rounded-xl border">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {markers.map((m) => (
        <Marker key={`${m.kind}-${m.id}`} position={[m.latitude, m.longitude]} icon={dot(MARKER_COLORS[m.kind].color)}>
          <Tooltip>{m.name}</Tooltip>
        </Marker>
      ))}
      <FlyTo focus={focus} />
    </MapContainer>
  );
}

function FlyTo({ focus }: { focus?: LatLon | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.latitude, focus.longitude], 16, { duration: 0.8 });
  }, [focus, map]);
  return null;
}

/** A round coloured marker; Leaflet's default image markers don't survive bundling. */
function dot(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:2px solid #fbf8f2;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    tooltipAnchor: [9, 0],
  });
}
