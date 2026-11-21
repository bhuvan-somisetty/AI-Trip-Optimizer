"use client";

import { useEffect, useState } from "react";
import { Compass, ExternalLink, Landmark, Loader2, MapPin, RefreshCw, Utensils, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/common";
import * as api from "@/lib/api";
import type { DishResponse, ExploreResponse, PlaceResponse } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useStore } from "@/lib/store";

/**
 * Places to see, local food and restaurants at the trip's destination (GET /trips/{id}/explore).
 * Only what the API sent is shown, each with its source label; an empty list shows the API's notice.
 * Nothing here changes the trip's prices, budget check or Trade-off Ledger.
 */
export function ExploreTab({ tripId }: { tripId: string }) {
  const token = useStore().session?.token;
  const [attempt, setAttempt] = useState(0);
  const key = `${tripId}:${attempt}`;
  const [result, setResult] = useState<{ key: string; data?: ExploreResponse; error?: string }>();

  useEffect(() => {
    if (!token) return;
    let live = true;
    api.getExplore(token, tripId).then(
      (data) => live && setResult({ key, data }),
      (e) => live && setResult({ key, error: (e as Error).message })
    );
    return () => {
      live = false;
    };
  }, [token, tripId, key]);

  if (!token) {
    return (
      <Card>
        <EmptyState icon={Compass} title="Explore needs the server" description="Places, food and restaurants come from the API. Sign in with your account to see them." />
      </Card>
    );
  }
  if (result?.key !== key) {
    return (
      <Card>
        <EmptyState
          icon={Loader2}
          className="[&_svg]:animate-spin"
          title="Finding places to see and local food…"
          description="The first time a city is explored this can take up to a minute while map data is fetched. After that it loads quickly."
        />
      </Card>
    );
  }
  if (result.error || !result.data) {
    return (
      <Card>
        <EmptyState
          icon={Compass}
          title="Couldn't load places"
          description={result.error}
          action={
            <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              <RefreshCw />
              Try again
            </Button>
          }
        />
      </Card>
    );
  }

  const x = result.data;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Explore {x.city_name}</CardTitle>
          <CardDescription>
            Places and restaurants are map data{x.source ? ` from ${x.source}` : ""}
            {x.fetched_at ? `, fetched ${formatDate(x.fetched_at)}` : ""}. Local food is an AI suggestion, with photos from Wikipedia. None of this changes the
            trip&apos;s prices, budget check or Trade-off Ledger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OsmCredit />
        </CardContent>
      </Card>

      <Section icon={Landmark} title="Places to see">
        {x.attractions.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {x.attractions.map((p) => (
              <PlaceCard key={p.id} place={p} />
            ))}
          </div>
        ) : (
          <Notice text={x.notice ?? "No places to see were found for this city."} />
        )}
      </Section>

      <Section icon={UtensilsCrossed} title="Local food">
        {x.dishes.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {x.dishes.map((d) => (
              <DishCard key={d.name} dish={d} />
            ))}
          </div>
        ) : (
          <Notice text={x.dishes_notice ?? "No local dishes were found for this city."} />
        )}
      </Section>

      <Section icon={Utensils} title="Restaurants">
        {x.restaurants.length ? (
          <Card className="py-0">
            <ul className="divide-y">
              {x.restaurants.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                  <span className="font-medium">{r.name}</span>
                  {r.category && <Badge variant="secondary" className="font-normal">{r.category}</Badge>}
                  {r.distance_m !== null && <span className="text-xs text-muted-foreground">{km(r.distance_m)} from the centre</span>}
                  <span className="ml-auto text-[11px] text-muted-foreground">{r.data_label}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Notice text={x.notice ?? "No restaurants were found for this city."} />
        )}
      </Section>
    </div>
  );
}

function PlaceCard({ place: p }: { place: PlaceResponse }) {
  return (
    <Card className="gap-3 overflow-hidden pt-0">
      {p.image ? (
        <Photo src={p.image} alt={p.name} label={photoLabel(p.image)} />
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center bg-muted text-xs text-muted-foreground">No photo in the map data</div>
      )}
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          {p.category && <Badge variant="secondary" className="font-normal">{p.category}</Badge>}
          <Badge variant="outline" className="font-normal">{p.data_label}</Badge>
        </div>
        <CardTitle className="text-base">{p.name}</CardTitle>
        {p.distance_m !== null && (
          <CardDescription className="flex items-center gap-1">
            <MapPin className="size-3.5" />
            {km(p.distance_m)} from the city centre
          </CardDescription>
        )}
      </CardHeader>
      {(p.description || p.wikipedia) && (
        <CardContent className="space-y-2 text-sm">
          {p.description && <p className="text-muted-foreground">{p.description}</p>}
          {p.wikipedia && <WikiLink href={p.wikipedia} />}
        </CardContent>
      )}
    </Card>
  );
}

function DishCard({ dish: d }: { dish: DishResponse }) {
  return (
    <Card className="gap-3 overflow-hidden pt-0">
      {d.image ? (
        <Photo src={d.image} alt={d.name} label={d.image_label ?? undefined} />
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center bg-muted text-xs text-muted-foreground">No photo found on Wikipedia</div>
      )}
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
        {d.wikipedia && <WikiLink href={d.wikipedia} />}
      </CardContent>
    </Card>
  );
}

function Photo({ src, alt, label }: { src: string; alt: string; label?: string }) {
  const thumb = wikimediaThumb(src);
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element -- Wikipedia and OpenTripMap image hosts vary, so next/image can't list them */}
      <img
        src={failed ? thumb.original : thumb.src}
        alt={alt}
        loading="lazy"
        onError={() => thumb.original && setFailed(true)}
        className="aspect-[16/10] w-full object-cover"
      />
      {label && <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{label}</span>}
    </div>
  );
}

// Wikimedia only serves thumbnails at its standard widths (https://w.wiki/GHai) and answers 400 for
// others, such as the 400px previews OpenTripMap gives.
const THUMB_WIDTH = 330;
const WIKIMEDIA_THUMB = /^(https:\/\/upload\.wikimedia\.org\/[^?#]+?)\/thumb\/([^?#]+)\/\d+px-([^/?#]+)$/;

/** A Wikimedia thumbnail at a standard width, and the original file to fall back to; other URLs unchanged. */
export function wikimediaThumb(url: string): { src: string; original?: string } {
  const m = url.match(WIKIMEDIA_THUMB);
  if (!m) return { src: url };
  const [, base, file, name] = m;
  return { src: `${base}/thumb/${file}/${THUMB_WIDTH}px-${name}`, original: `${base}/${file}` };
}

function WikiLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
      Read more on Wikipedia <ExternalLink className="size-3" />
    </a>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Landmark; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Notice({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{text}</p>;
}

function OsmCredit() {
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

const km = (metres: number) => `${(metres / 1000).toFixed(1)} km`;

/** OpenTripMap's photos are almost always Wikimedia Commons files; say so only when the address shows it. */
function photoLabel(url: string) {
  try {
    return new URL(url).hostname.endsWith("wikimedia.org") ? "Photo: Wikimedia Commons" : "Photo: OpenTripMap";
  } catch {
    return "Photo: OpenTripMap";
  }
}
