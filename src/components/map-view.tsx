"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

export interface MapPlace {
  id: string;
  title: string;
  kind: string;
  icon: string;
  /** Already formatted for display — the server owns timezone handling. */
  when: string;
  lat: number;
  lng: number;
  /** The other end of a journey, drawn as a line from this point. */
  to?: { lat: number; lng: number } | null;
}

/**
 * Leaflet is driven directly rather than through a React wrapper: the map owns
 * its own DOM and does not re-render, so a wrapper would only add a dependency
 * that has to keep pace with React's release cycle.
 */
export function MapView({ places }: { places: MapPlace[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = L.map(container.current, {
      scrollWheelZoom: false, // Otherwise the page can't be scrolled past the map on a phone.
      attributionControl: true,
    });
    map.current = instance;

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(instance);

    /*
     * Framing follows where time is spent, not every point on the map. Fitting
     * all of them means one intercontinental flight zooms the view out to the
     * whole globe and collapses a fortnight in Britain into a single dot; the
     * flight lines still run off the edge, which reads correctly.
     */
    const bounds: [number, number][] = [];
    const stayBounds: [number, number][] = [];

    for (const place of places) {
      bounds.push([place.lat, place.lng]);
      if (place.kind !== "flight") stayBounds.push([place.lat, place.lng]);

      L.marker([place.lat, place.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="font-size:20px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">${place.icon}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      })
        .addTo(instance)
        .bindPopup(
          `<strong>${place.title}</strong><br><span style="color:#78716c">${place.when}</span>`,
        );

      if (place.to) {
        bounds.push([place.to.lat, place.to.lng]);
        L.polyline(
          [
            [place.lat, place.lng],
            [place.to.lat, place.to.lng],
          ],
          { color: "#0ea5e9", weight: 2, opacity: 0.7, dashArray: "5 6" },
        ).addTo(instance);
      }
    }

    const framing = stayBounds.length > 0 ? stayBounds : bounds;
    if (framing.length > 0) {
      instance.fitBounds(framing, { padding: [40, 40], maxZoom: 11 });
    } else {
      instance.setView([51.5, -0.12], 4);
    }

    return () => {
      instance.remove();
      map.current = null;
    };
  }, [places]);

  return (
    <div
      ref={container}
      className="h-[65vh] min-h-80 w-full overflow-hidden rounded-xl border border-edge"
    />
  );
}
