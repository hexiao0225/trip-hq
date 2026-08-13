import "server-only";

/**
 * Turns the places on a booking into coordinates for the map.
 *
 * Uses OpenStreetMap's Nominatim: no API key and no billing, unlike the Google
 * and Mapbox geocoders. The trade is a published limit of one request per
 * second and a requirement to identify yourself, so results are cached on the
 * segment row and only ever looked up once.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const CONTACT = "trip-hq (personal trip planner)";

/** Nominatim asks for no more than one request per second. */
const MIN_INTERVAL_MS = 1100;
let lastRequestAt = 0;

export interface Coordinates {
  lat: number;
  lng: number;
}

async function pace(): Promise<void> {
  const waitFor = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (waitFor > 0) await new Promise((resolve) => setTimeout(resolve, waitFor));
  lastRequestAt = Date.now();
}

export async function geocode(query: string): Promise<Coordinates | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  await pace();

  const url = new URL(ENDPOINT);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": CONTACT, Accept: "application/json" },
    });
    if (!response.ok) return null;

    const results = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
    }>;
    const first = results[0];
    if (!first?.lat || !first?.lon) return null;

    const lat = Number(first.lat);
    const lng = Number(first.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/** UK-style postcodes and US ZIPs, which geocode far better than a long address. */
const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}|\d{5}(?:-\d{4})?)\b/i;

/**
 * Progressively less specific ways to describe a place.
 *
 * A full address is tried first, but a confirmation email often gives one
 * that is too specific to match anything — "Artists Flat (above café),
 * Dumfries House, Cumnock, Ayrshire, KA18 2NJ" finds nothing, while its
 * postcode alone is exact. Each candidate drops the most fragile part of the
 * previous one, and the first hit wins.
 */
export function placeQueries(
  label: string | null,
  city: string | null,
  address?: string | null,
): string[] {
  const candidates: string[] = [];
  const street = address?.trim();
  const name = label?.trim();
  const town = city?.trim();

  if (street) {
    candidates.push(street);

    // Venue descriptors in brackets rarely exist in the map data.
    const withoutAsides = street.replace(/\s*\([^)]*\)/g, "").trim();
    if (withoutAsides && withoutAsides !== street) candidates.push(withoutAsides);

    // The tail of an address — town, postcode, country — is the reliable part.
    const parts = withoutAsides.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 2) candidates.push(parts.slice(-3).join(", "));

    const postcode = street.match(POSTCODE)?.[1];
    if (postcode) candidates.push(town ? `${postcode}, ${town}` : postcode);
  }

  if (name && town) {
    candidates.push(
      name.toLowerCase().includes(town.toLowerCase()) ? name : `${name}, ${town}`,
    );
  } else if (name) {
    candidates.push(name);
  }

  if (town) candidates.push(town);

  return [...new Set(candidates)];
}

/** Try each description in turn and take the first that resolves. */
export async function geocodePlace(
  label: string | null,
  city: string | null,
  address?: string | null,
): Promise<Coordinates | null> {
  for (const query of placeQueries(label, city, address)) {
    const hit = await geocode(query);
    if (hit) return hit;
  }
  return null;
}
