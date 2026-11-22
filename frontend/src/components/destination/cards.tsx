"use client";

import { useState } from "react";
import {
  Building2,
  Castle,
  ChevronDown,
  Clock,
  ExternalLink,
  Landmark,
  MapPin,
  Mountain,
  Navigation,
  ShoppingBasket,
  Star,
  Trees,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { wikimediaThumb } from "@/components/trips/explore";
import type { DishResponse, FoodSpotResponse, PlaceResponse } from "@/lib/api";
import { directionsUrl, km, mapUrl, pointOf, type LatLon } from "@/lib/geo";
import { cn } from "@/lib/utils";

/**
 * Cards for the destination page: places, restaurants, food markets and dishes. They show only
 * what the API sent, each with its source label; a missing photo gets a neutral illustration,
 * never somebody else's photo.
 */

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Fort: Castle,
  Monument: Landmark,
  Museum: Building2,
  "Historic place": Landmark,
  "Religious site": Landmark,
  Architecture: Building2,
  Culture: Building2,
  Beach: Mountain,
  Nature: Trees,
  Park: Trees,
  Viewpoint: Mountain,
  Market: ShoppingBasket,
  "Food court": Utensils,
};

/** A soft illustrated placeholder for a place without a photo. */
export function Placeholder({ category, className }: { category: string | null | undefined; className?: string }) {
  const Icon = (category && CATEGORY_ICON[category]) || Utensils;
  return (
    <div className={cn("flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br from-muted to-primary/10", className)}>
      <Icon className="size-10 text-primary/40" aria-hidden />
      <span className="sr-only">No photo available</span>
    </div>
  );
}

export function Photo({ src, alt, label, attribution }: {
  src: string;
  alt: string;
  label?: string | null;
  attribution?: { author: string | null; author_url: string | null } | null;
}) {
  const thumb = wikimediaThumb(src);
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element -- photo hosts vary (Wikimedia, Google), so next/image can't list them */}
      <img
        src={failed ? thumb.original : thumb.src}
        alt={alt}
        loading="lazy"
        onError={() => thumb.original && setFailed(true)}
        className="aspect-[16/10] w-full object-cover"
      />
      {(label || attribution?.author) && (
        <span className="absolute right-1.5 bottom-1.5 max-w-[90%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          {label}
          {attribution?.author && (
            <>
              {label ? " · " : ""}
              {attribution.author_url ? (
                <a href={attribution.author_url} target="_blank" rel="noopener noreferrer" className="underline">
                  {attribution.author}
                </a>
              ) : (
                attribution.author
              )}
            </>
          )}
        </span>
      )}
    </div>
  );
}

function photoLabel(p: PlaceResponse) {
  if (p.image_label) return p.image_label;
  try {
    return p.image && new URL(p.image).hostname.endsWith("wikimedia.org") ? "Photo: Wikimedia Commons" : "Photo: OpenTripMap";
  } catch {
    return "Photo: OpenTripMap";
  }
}

/** "View on map" (the page's own map when it has one) and "Directions" buttons. */
export function MapActions({ to, from, onShow }: { to: LatLon | null; from?: LatLon | null; onShow?: () => void }) {
  if (!to) return null;
  const button = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-accent";
  return (
    <div className="flex flex-wrap gap-2">
      {onShow ? (
        <button type="button" className={button} onClick={onShow}>
          <MapPin className="size-3.5" /> View on map
        </button>
      ) : (
        <a href={mapUrl(to)} target="_blank" rel="noopener noreferrer" className={button}>
          <MapPin className="size-3.5" /> View on map
        </a>
      )}
      <a href={directionsUrl(to, from)} target="_blank" rel="noopener noreferrer" className={button}>
        <Navigation className="size-3.5" /> Directions
      </a>
    </div>
  );
}

function Hours({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Clock className="mt-0.5 size-3.5 shrink-0" />
      <span>
        <span className="font-medium text-foreground">Opening hours (OpenStreetMap): </span>
        {text}
      </span>
    </p>
  );
}

/** An attraction: photo, name, category, description, address, hours, distance, map and directions. */
export function PlaceTile({ place: p, from, distanceFrom, onShow }: {
  place: PlaceResponse;
  /** where directions start: the hotel, or the user's location once allowed */
  from?: LatLon | null;
  /** what distance_m is measured from, e.g. "the city centre" */
  distanceFrom?: string;
  onShow?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const long = (p.description?.length ?? 0) > 180;
  return (
    <Card className="gap-3 overflow-hidden pt-0">
      {p.image ? <Photo src={p.image} alt={p.name} label={photoLabel(p)} attribution={p.photo_attribution} /> : <Placeholder category={p.category} />}
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          {p.category && <Badge variant="secondary" className="font-normal">{p.category}</Badge>}
          <Badge variant="outline" className="font-normal">{p.data_label}</Badge>
        </div>
        <CardTitle className="text-base">{p.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {p.description && (
          <p className={cn("text-muted-foreground", !open && long && "line-clamp-3")}>{p.description}</p>
        )}
        {long && (
          <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            {open ? "Show less" : "More details"} <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
          </button>
        )}
        {p.address && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            {p.address}
          </p>
        )}
        {p.opening_hours && <Hours text={p.opening_hours} />}
        {p.distance_m !== null && distanceFrom && <p className="text-xs text-muted-foreground">{km(p.distance_m)} from {distanceFrom}</p>}
        {p.rating_label && p.rating !== null && (
          <p className="text-xs text-muted-foreground">
            {p.rating_label}: {String(p.rating)}
          </p>
        )}
        {p.wikipedia && (
          <a href={p.wikipedia} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Read more on Wikipedia <ExternalLink className="size-3" />
          </a>
        )}
        <MapActions to={pointOf(p)} from={from} onShow={onShow} />
      </CardContent>
    </Card>
  );
}

/** A restaurant: OpenStreetMap's cuisine, address and hours, and Google's photo and rating when present. */
export function RestaurantTile({ place: r, from, onShow }: { place: PlaceResponse; from?: LatLon | null; onShow?: () => void }) {
  const g = r.google;
  return (
    <Card className="gap-3 overflow-hidden pt-0">
      {r.image ? <Photo src={r.image} alt={r.name} label={photoLabel(r)} attribution={r.photo_attribution} /> : <Placeholder category="Food court" />}
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          {r.category && <Badge variant="secondary" className="font-normal">{r.category}</Badge>}
          {r.cuisine && <Badge variant="outline" className="font-normal capitalize">{r.cuisine}</Badge>}
          <Badge variant="outline" className="font-normal">{r.data_label}</Badge>
        </div>
        <CardTitle className="text-base">{r.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {g?.rating !== null && g?.rating !== undefined && (
          <p className="flex items-center gap-1 text-xs">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            <span className="font-medium">{g.rating.toFixed(1)}</span>
            {g.rating_count !== null && <span className="text-muted-foreground">({g.rating_count.toLocaleString("en-IN")} reviews, Google)</span>}
          </p>
        )}
        {(g?.address || r.address) && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            {g?.address || r.address}
          </p>
        )}
        {r.opening_hours && <Hours text={r.opening_hours} />}
        {!!g?.opening_hours?.length && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">Opening hours (Google)</summary>
            <ul className="mt-1 space-y-0.5">
              {g.opening_hours.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        )}
        {g?.maps_url && (
          <a href={g.maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Open in Google Maps <ExternalLink className="size-3" />
          </a>
        )}
        <MapActions to={pointOf(r)} from={from} onShow={onShow} />
      </CardContent>
    </Card>
  );
}

/** A food market or food court from OpenStreetMap. */
export function FoodSpotTile({ spot: f, from, onShow }: { spot: FoodSpotResponse; from?: LatLon | null; onShow?: () => void }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="font-normal">{f.category}</Badge>
          <Badge variant="outline" className="font-normal">{f.data_label}</Badge>
        </div>
        <CardTitle className="text-base">{f.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 text-sm">
        {f.address && <p className="text-xs text-muted-foreground">{f.address}</p>}
        {f.opening_hours && <Hours text={f.opening_hours} />}
        {f.distance_m !== null && <p className="text-xs text-muted-foreground">{km(f.distance_m)} from the city centre</p>}
        <MapActions to={{ latitude: f.latitude, longitude: f.longitude }} from={from} onShow={onShow} />
      </CardContent>
    </Card>
  );
}

/** A local dish: the AI's name and line, Wikipedia's photo and text when found. */
export function DishTile({ dish: d }: { dish: DishResponse }) {
  return (
    <Card className="gap-3 overflow-hidden pt-0">
      {d.image ? <Photo src={d.image} alt={d.name} label={d.image_label} /> : <Placeholder category="Food court" />}
      <CardHeader>
        <div>
          <Badge variant="outline" className="border-primary/30 font-normal text-primary">{d.data_label}</Badge>
        </div>
        <CardTitle className="text-base">{d.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {d.ai_description && <p className="text-muted-foreground">{d.ai_description}</p>}
        {d.wikipedia_text && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Wikipedia: </span>
            {d.wikipedia_text}
          </p>
        )}
        {d.wikipedia && (
          <a href={d.wikipedia} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Read more on Wikipedia <ExternalLink className="size-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export function SectionTitle({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Icon className="size-5 text-primary" />
        {title}
      </h2>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Notice({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{text}</p>;
}

export function OsmCredit() {
  return (
    <p className="text-xs text-muted-foreground">
      ©{" "}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
        OpenStreetMap
      </a>{" "}
      contributors
    </p>
  );
}
