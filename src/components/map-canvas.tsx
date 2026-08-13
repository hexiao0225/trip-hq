"use client";

import dynamic from "next/dynamic";

import type { MapPlace } from "@/components/map-view";

/**
 * Leaflet reaches for `window` as soon as it is imported, which crashes the
 * server render. Loading it only in the browser is the fix, and `ssr: false`
 * is only allowed from a client component — hence this wrapper.
 */
const MapView = dynamic(
  () => import("@/components/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[65vh] min-h-80 w-full items-center justify-center rounded-xl border border-edge bg-surface text-sm text-muted">
        Loading map…
      </div>
    ),
  },
);

export function MapCanvas({ places }: { places: MapPlace[] }) {
  return <MapView places={places} />;
}
