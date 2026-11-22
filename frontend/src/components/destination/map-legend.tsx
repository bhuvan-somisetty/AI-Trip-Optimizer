/** Marker kinds and colours for the destination map, kept apart from Leaflet so pages can import them. */

export type MarkerKind = "explore" | "history" | "restaurant" | "market" | "me";

export type MapMarker = { id: string; name: string; latitude: number; longitude: number; kind: MarkerKind };

export const MARKER_COLORS: Record<MarkerKind, { color: string; label: string }> = {
  history: { color: "#8a4b2a", label: "History and culture" },
  explore: { color: "#3f7d4e", label: "Explore" },
  restaurant: { color: "#e04e22", label: "Restaurants" },
  market: { color: "#b8860b", label: "Markets and food courts" },
  me: { color: "#1d4ed8", label: "You" },
};

export function MapLegend({ kinds }: { kinds: MarkerKind[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full" style={{ background: MARKER_COLORS[k].color }} />
          {MARKER_COLORS[k].label}
        </span>
      ))}
    </div>
  );
}
