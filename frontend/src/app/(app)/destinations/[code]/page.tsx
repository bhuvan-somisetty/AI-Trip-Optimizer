"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BedDouble, CarFront, Compass, ExternalLink, Landmark, Loader2, LocateFixed, MapPinned, RefreshCw, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/app/common";
import { DishTile, FoodSpotTile, Notice, OsmCredit, PlaceTile, Photo, RestaurantTile, SectionTitle } from "@/components/destination/cards";
import { MapLegend, type MapMarker, type MarkerKind } from "@/components/destination/map-legend";
import * as api from "@/lib/api";
import type { DestinationResponse, NearbyResponse } from "@/lib/api";
import { pointOf, type LatLon } from "@/lib/geo";
import { cityName, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// Leaflet touches `window` when it loads, so the map only renders in the browser.
const PlacesMap = dynamic(() => import("@/components/destination/places-map"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-xl border bg-muted" />,
});

type Located = { state: "idle" } | { state: "asking" } | { state: "denied"; message: string } | { state: "found"; at: LatLon; nearby?: NearbyResponse; error?: string };

/**
 * Everything about a destination (GET /destinations/{code}): overview, Explore Your Destination,
 * History and Culture, Day Trips Nearby, Famous Hotels, Taste the Destination, a map and "near me".
 * Only what the API sent is shown.
 */
export default function DestinationPage() {
  const { code: raw } = useParams<{ code: string }>();
  const code = (raw ?? "").toUpperCase();
  const token = useStore().session?.token;
  const [attempt, setAttempt] = useState(0);
  const key = `${code}:${attempt}`;
  const [result, setResult] = useState<{ key: string; data?: DestinationResponse; error?: string }>();
  const [focus, setFocus] = useState<LatLon | null>(null);
  const [me, setMe] = useState<Located>({ state: "idle" });

  useEffect(() => {
    if (!token || !code) return;
    let live = true;
    api.getDestination(token, code).then(
      (data) => live && setResult({ key, data }),
      (e) => live && setResult({ key, error: (e as Error).message })
    );
    return () => {
      live = false;
    };
  }, [token, code, key]);

  const d = result?.key === key ? result.data : undefined;
  const from = me.state === "found" ? me.at : null;
  const show = (p: { latitude: number | null; longitude: number | null }) => () => {
    const at = pointOf(p);
    if (at) {
      setFocus(at);
      document.getElementById("destination-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const markers = useMemo<MapMarker[]>(() => {
    if (!d) return [];
    const out: MapMarker[] = [];
    const add = (id: string, name: string, lat: number | null, lon: number | null, kind: MarkerKind) => {
      if (lat !== null && lon !== null) out.push({ id, name, latitude: lat, longitude: lon, kind });
    };
    d.attractions.forEach((a) => add(a.id, a.name, a.latitude, a.longitude, a.section === "history_culture" ? "history" : "explore"));
    d.restaurants.forEach((r) => add(r.id, r.name, r.latitude, r.longitude, "restaurant"));
    (d.food_spots ?? []).forEach((f) => add(f.id, f.name, f.latitude, f.longitude, "market"));
    if (me.state === "found") add("me", "You are here", me.at.latitude, me.at.longitude, "me");
    return out;
  }, [d, me]);

  function locate() {
    if (!token) return;
    if (!("geolocation" in navigator)) {
      setMe({ state: "denied", message: "This browser can't share its location." });
      return;
    }
    setMe({ state: "asking" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMe({ state: "found", at });
        api.getNearby(token, at.latitude, at.longitude).then(
          (nearby) => setMe({ state: "found", at, nearby }),
          (e) => setMe({ state: "found", at, error: (e as Error).message })
        );
      },
      (err) =>
        setMe({
          state: "denied",
          message: err.code === err.PERMISSION_DENIED ? "Location permission was not given, so nearby places can't be shown. Everything else still works." : "Your location couldn't be found right now.",
        }),
      { timeout: 15000 }
    );
  }

  if (!token) {
    return (
      <Card className="mx-auto max-w-3xl">
        <EmptyState icon={Compass} title="Destinations need the server" description="Places, food and photos come from the API. Sign in with your account to see them." />
      </Card>
    );
  }

  if (result?.key !== key) {
    return (
      <Card className="mx-auto max-w-3xl">
        <EmptyState
          icon={Loader2}
          className="[&_svg]:animate-spin"
          title={`Loading ${cityName(code)}…`}
          description="The first visit to a city can take up to a minute while places, food and photos are fetched. After that it loads quickly."
        />
      </Card>
    );
  }

  if (result.error || !d) {
    return (
      <Card className="mx-auto max-w-3xl">
        <EmptyState
          icon={Compass}
          title="Couldn't load this destination"
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

  const explore = d.attractions.filter((a) => a.section !== "history_culture");
  const history = d.attractions.filter((a) => a.section === "history_culture");
  const spots = d.food_spots ?? [];
  const kinds = (["explore", "history", "restaurant", "market", "me"] as MarkerKind[]).filter((k) => markers.some((m) => m.kind === k));

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Dashboard
      </Link>

      {/* Overview */}
      <Card className="overflow-hidden py-0">
        <div className="grid md:grid-cols-[2fr_3fr]">
          {d.overview?.image ? (
            <Photo src={d.overview.image} alt={d.city_name} label={d.overview.image_label} />
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-primary/20 to-muted">
              <MapPinned className="size-12 text-primary/50" />
            </div>
          )}
          <div className="space-y-3 p-6">
            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">{d.country_name}</p>
            <h1 className="text-3xl font-semibold sm:text-4xl">{d.city_name}</h1>
            {d.overview?.text ? <p className="text-sm leading-relaxed text-muted-foreground">{d.overview.text}</p> : <p className="text-sm text-muted-foreground">Wikipedia has no overview for this city.</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {d.overview?.wikipedia && (
                <a href={d.overview.wikipedia} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Read more on Wikipedia <ExternalLink />
                </a>
              )}
              <Link href={`/search?to=${d.city}`} className={cn(buttonVariants({ size: "sm" }))}>
                Find flights, trains and buses
              </Link>
              <Link href={`/planning?to=${d.city}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Plan a trip here
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* Map */}
      <section id="destination-map" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle icon={MapPinned} title="On the map" hint="Every place below, coloured by section. Use “View on map” on a card to jump to it." />
          <Button variant="outline" size="sm" onClick={locate} disabled={me.state === "asking"}>
            {me.state === "asking" ? <Loader2 className="animate-spin" /> : <LocateFixed />}
            Near me
          </Button>
        </div>
        <PlacesMap markers={markers} focus={focus} centre={d.location} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MapLegend kinds={kinds} />
          <OsmCredit />
        </div>
        {me.state === "denied" && <Notice text={me.message} />}
      </section>

      {me.state === "found" && (
        <section className="space-y-4">
          <SectionTitle icon={LocateFixed} title="Near you" hint="Within 3 km of your location. Directions start from where you are." />
          {me.error ? (
            <Notice text={me.error} />
          ) : !me.nearby ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Finding places near you…</p>
          ) : me.nearby.attractions.length || me.nearby.restaurants.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[...me.nearby.attractions, ...me.nearby.restaurants].map((p) => (
                <PlaceTile key={`near-${p.id}`} place={p} from={me.at} distanceFrom="you" />
              ))}
            </div>
          ) : (
            <Notice text={me.nearby.notice ?? "No places were found near you."} />
          )}
        </section>
      )}

      <section className="space-y-4">
        <SectionTitle icon={Compass} title="Explore Your Destination" hint="Nature, beaches, viewpoints, parks and sightseeing." />
        {explore.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {explore.map((p) => (
              <PlaceTile key={p.id} place={p} from={from} distanceFrom="the city centre" onShow={show(p)} />
            ))}
          </div>
        ) : (
          <Notice text={d.notice ?? "No nature or sightseeing spots were found for this city."} />
        )}
      </section>

      <section className="space-y-4">
        <SectionTitle icon={Landmark} title="History and Culture" hint="Forts, palaces, monuments, museums, temples and heritage buildings." />
        {history.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {history.map((p) => (
              <PlaceTile key={p.id} place={p} from={from} distanceFrom="the city centre" onShow={show(p)} />
            ))}
          </div>
        ) : (
          <Notice text={d.notice ?? "No historical places were found for this city."} />
        )}
      </section>

      {d.day_trips && (
        <section className="space-y-4">
          <SectionTitle icon={CarFront} title="Day Trips Nearby" hint="Famous forts, temples, national parks, lakes and waterfalls 15 to 150 km away, the best known first." />
          {d.day_trips.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {d.day_trips.map((p) => (
                <PlaceTile key={p.id} place={p} from={from} distanceFrom={d.around_from ?? "the city"} />
              ))}
            </div>
          ) : (
            <Notice text={d.around_notice ?? "No famous places were found within a day trip of this city."} />
          )}
        </section>
      )}

      {d.famous_stays && (
        <section className="space-y-4">
          <SectionTitle icon={BedDouble} title="Famous Hotels" hint="Landmark and heritage hotels with a Wikipedia article. For prices, plan a trip: the optimizer searches live hotel rates." />
          {d.famous_stays.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {d.famous_stays.map((p) => (
                <PlaceTile key={p.id} place={p} from={from} distanceFrom={d.around_from ?? "the city"} />
              ))}
            </div>
          ) : (
            <Notice text={d.around_notice ?? "No famous hotels are listed for this city."} />
          )}
        </section>
      )}

      <section className="space-y-6">
        <SectionTitle icon={UtensilsCrossed} title="Taste the Destination" hint="Famous local dishes (AI suggestions with Wikipedia photos), restaurants and food markets from the map." />
        <div className="space-y-3">
          <h3 className="font-semibold">Famous local dishes</h3>
          {d.dishes.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {d.dishes.map((dish) => (
                <DishTile key={dish.name} dish={dish} />
              ))}
            </div>
          ) : (
            <Notice text={d.dishes_notice ?? "No local dishes were found for this city."} />
          )}
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold">Restaurants</h3>
          {d.google_notice && <Notice text={d.google_notice} />}
          {d.restaurants.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {d.restaurants.map((r) => (
                <RestaurantTile key={r.id} place={r} from={from} onShow={show(r)} />
              ))}
            </div>
          ) : (
            <Notice text={d.notice ?? "No restaurants were found for this city."} />
          )}
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold">Markets and food courts</h3>
          {spots.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {spots.map((f) => (
                <FoodSpotTile key={f.id} spot={f} from={from} onShow={show(f)} />
              ))}
            </div>
          ) : (
            <Notice text="No named food markets or food courts are mapped around this city." />
          )}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where this comes from</CardTitle>
          <CardDescription>
            Places and restaurants: {d.source ?? "OpenTripMap"} and OpenStreetMap (map data). Day trips and famous hotels: {d.around_source ?? "Wikidata and Wikipedia"},
            ranked by how many Wikipedia languages write about them. Dishes: AI suggestions, photos from Wikipedia. Restaurant photos and ratings marked
            Google come from Google Places. Nothing here is invented: a missing photo shows an illustration and a missing field is left out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OsmCredit />
        </CardContent>
      </Card>
    </div>
  );
}
