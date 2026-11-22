"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPinned } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cities } from "@/lib/catalog";

// Six well-known destinations from the built-in list; any other city opens from search or a trip.
const POPULAR = ["GOI", "JAI", "DEL", "BOM", "DXB", "SIN"];
const SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/";

type Photo = { src: string; page: string | null } | null;

/**
 * Popular destination cards. The photo is the city's own Wikipedia lead image, asked straight from
 * Wikipedia's public API (no key, no server load); without one the card shows an illustration.
 * A card opens the destination page.
 */
export function PopularDestinations() {
  const shown = POPULAR.map((code) => cities.find((c) => c.code === code)).filter((c): c is (typeof cities)[number] => !!c);
  const [photos, setPhotos] = useState<Record<string, Photo>>({});

  useEffect(() => {
    let live = true;
    shown.forEach((c) => {
      fetch(SUMMARY + encodeURIComponent(c.name.replace(/ /g, "_")))
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => {
          if (!live) return;
          const src = body?.type === "standard" ? body?.thumbnail?.source : null;
          setPhotos((p) => ({ ...p, [c.code]: src ? { src, page: body?.content_urls?.desktop?.page ?? null } : null }));
        })
        .catch(() => live && setPhotos((p) => ({ ...p, [c.code]: null })));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the list is fixed
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">Popular destinations</h2>
          <p className="text-sm text-muted-foreground">Places to see, history, local food and a map for each city.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {shown.map((c) => {
          const photo = photos[c.code];
          return (
            <Link key={c.code} href={`/destinations/${c.code}`} className="group">
              <Card className="relative gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Wikimedia hosts vary
                  <img src={photo.src} alt={c.name} loading="lazy" className="aspect-[4/5] w-full object-cover transition-transform group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex aspect-[4/5] items-center justify-center bg-gradient-to-br from-primary/25 to-muted">
                    <MapPinned className="size-10 text-primary/50" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 text-white">
                  <p className="font-semibold">{c.name}</p>
                  <p className="flex items-center gap-1 text-[11px] opacity-80">
                    {c.country} <ArrowRight className="size-3" />
                  </p>
                </div>
                {photo && <span className="absolute top-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-white">Photo: Wikipedia</span>}
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
