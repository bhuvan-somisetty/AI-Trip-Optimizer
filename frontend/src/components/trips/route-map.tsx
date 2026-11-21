"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from "react-leaflet";
import type { RouteResponse } from "@/lib/api";

/**
 * The trip's hotel, its numbered stops and the road path of each leg on OpenStreetMap tiles.
 * Leaflet needs `window`, so the Route tab loads this with next/dynamic and ssr: false.
 */
export default function RouteMap({ route }: { route: RouteResponse }) {
  const hotel = route.hotel;
  if (!hotel) return null;
  const points: [number, number][] = [
    [hotel.latitude, hotel.longitude],
    ...route.stops.map((s) => [s.latitude, s.longitude] as [number, number]),
    ...route.legs.flatMap((leg) => leg.path),
  ];
  return (
    <MapContainer bounds={L.latLngBounds(points)} boundsOptions={{ padding: [28, 28] }} scrollWheelZoom={false} className="h-[420px] w-full rounded-xl border lg:h-full lg:min-h-[480px]">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {route.legs.map((leg, i) => (
        <Polyline key={i} positions={leg.path} pathOptions={{ color: "#e04e22", weight: 4, opacity: 0.85 }} />
      ))}
      <Marker position={[hotel.latitude, hotel.longitude]} icon={pin("H", "#0f1b2d")}>
        <Tooltip>{hotel.name} (hotel)</Tooltip>
      </Marker>
      {route.stops.map((s) => (
        <Marker key={s.order} position={[s.latitude, s.longitude]} icon={pin(String(s.order), "#e04e22")}>
          <Tooltip>
            {s.order}. {s.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

/** A round numbered marker; Leaflet's default image markers don't survive bundling. */
function pin(text: string, color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${color};color:#fbf8f2;font:600 12px/1 system-ui,sans-serif;border:2px solid #fbf8f2;box-shadow:0 1px 4px rgba(0,0,0,.35)">${text}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    tooltipAnchor: [14, 0],
  });
}
