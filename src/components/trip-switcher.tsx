"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { accent } from "@/lib/accents";

export interface TripLink {
  slug: string;
  name: string;
  emoji: string | null;
  accent: string;
  /** "In progress", "in 12 days", "Sep 2026" — set by the server. */
  when: string;
  pending: number;
}

/**
 * Switches between trips from the header.
 *
 * A `<details>` element rather than a listbox: it opens on tap without any
 * state to manage, closes with Escape for free, and every row inside stays a
 * plain link, which is what makes the whole thing work with a thumb.
 */
export function TripSwitcher({
  current,
  trips,
}: {
  current: TripLink;
  trips: TripLink[];
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  // Close when anything outside is tapped, so it doesn't sit open over the
  // timeline after a mis-tap.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <details
      ref={ref}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="relative mr-auto min-w-0"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg pr-2 pl-1 transition hover:bg-stone-100 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-base">
          {current.emoji ?? "🧭"}
        </span>
        <span className="truncate text-base font-semibold tracking-tight">
          {current.name}
        </span>
        <span aria-hidden className="text-xs text-muted">
          ▾
        </span>
        <span className="sr-only">Switch trip</span>
      </summary>

      <div className="absolute top-full left-0 z-30 mt-1 w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-edge bg-surface shadow-lg">
        <ul className="max-h-80 overflow-auto">
          {trips.map((trip) => (
            <li key={trip.slug}>
              <Link
                href={`/t/${trip.slug}`}
                onClick={() => setOpen(false)}
                className={`flex min-h-12 items-center gap-2.5 px-3 py-2 transition hover:bg-stone-100 ${
                  trip.slug === current.slug ? "bg-stone-100" : ""
                }`}
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${accent(trip.accent).dotClass}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {trip.emoji ? `${trip.emoji} ` : ""}
                    {trip.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {trip.when}
                  </span>
                </span>
                {trip.pending > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {trip.pending}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex border-t border-edge">
          <Link
            href="/trips"
            onClick={() => setOpen(false)}
            className="flex min-h-11 flex-1 items-center px-3 text-sm text-muted transition hover:bg-stone-100 hover:text-foreground"
          >
            All trips
          </Link>
          <Link
            href="/trips/new"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center border-l border-edge px-3 text-sm font-medium transition hover:bg-stone-100"
          >
            New trip
          </Link>
        </div>
      </div>
    </details>
  );
}
