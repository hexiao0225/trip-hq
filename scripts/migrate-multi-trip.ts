/**
 * One-time migration from the single hardcoded trip to trips as rows.
 *
 * Before this, the trip lived in `src/lib/config.ts` and every segment simply
 * belonged to it. This script recreates that trip in the database, turns its
 * legs and milestones into rows, and files every existing booking under it.
 *
 *   npm run db:push          # add the new tables and columns first
 *   npm run db:migrate-trips # then this
 *
 * Safe to run more than once: it matches on slug and only fills in what is
 * missing, so a second run reports zero changes rather than duplicating.
 *
 *   --dry     print what would change and touch nothing
 *   --no-seed skip creating the empty Singapore trip
 */

import { config } from "dotenv";
import { and, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });
config({ path: ".env" });

const { inboundEmails, legs, milestones, segments, trips } = schema;

const DRY = process.argv.includes("--dry");
const SEED_SINGAPORE = !process.argv.includes("--no-seed");

/**
 * The trip exactly as `src/lib/config.ts` used to describe it. Copied here
 * rather than imported, because config.ts no longer holds trips and this
 * script has to keep working after that file changes again.
 */
const UK_TRIP = {
  slug: "uk",
  name: "UK & Beijing",
  destination: "London → Scotland → the residency → Beijing",
  emoji: "🇬🇧",
  startDate: null as string | null,
  endDate: "2026-09-25" as string | null,
  timezone: "Europe/London",
  currency: "GBP",
  travelers: ["xiao", "hanyang"],
  accent: "indigo",
  legs: [
    {
      slug: "london",
      label: "London",
      place: "London, UK",
      timezone: "Europe/London",
      startDate: null,
      endDate: null,
      travelers: ["xiao", "hanyang"],
      accent: "indigo",
    },
    {
      slug: "scotland",
      label: "Scotland",
      place: "Scotland, UK",
      timezone: "Europe/London",
      startDate: null,
      endDate: null,
      travelers: ["xiao", "hanyang"],
      accent: "emerald",
    },
    {
      slug: "residency",
      label: "Residency",
      place: "Dumfries House, Ayrshire",
      timezone: "Europe/London",
      startDate: null,
      endDate: "2026-09-24",
      travelers: ["xiao"],
      accent: "amber",
    },
    {
      slug: "beijing",
      label: "Beijing",
      place: "Beijing, China",
      timezone: "Asia/Shanghai",
      startDate: null,
      endDate: null,
      travelers: ["hanyang"],
      accent: "fuchsia",
    },
    {
      slug: "home",
      label: "Home",
      place: "San Mateo, CA",
      timezone: "America/Los_Angeles",
      startDate: null,
      endDate: null,
      travelers: ["xiao", "hanyang"],
      accent: "stone",
    },
  ],
  milestones: [
    {
      label: "Residency ends",
      date: "2026-09-24",
      timezone: "Europe/London",
      who: ["xiao"],
    },
    {
      label: "Fly home to San Mateo",
      date: "2026-09-25",
      timezone: "Europe/London",
      who: ["xiao"],
    },
  ],
};

/** An empty trip for the Singapore travel, ready to have dates filled in. */
const SINGAPORE_TRIP = {
  slug: "singapore",
  name: "Singapore",
  destination: "Singapore",
  emoji: "🇸🇬",
  timezone: "Asia/Singapore",
  currency: "SGD",
  travelers: ["xiao"],
  accent: "rose",
};

function log(message: string) {
  console.log(`${DRY ? "[dry] " : ""}${message}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL is not set. Put it in .env.local before running this.",
    );
    process.exit(1);
  }

  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  try {
    // --- the trip -------------------------------------------------------
    let uk = (
      await db.select().from(trips).where(eq(trips.slug, UK_TRIP.slug)).limit(1)
    )[0];

    if (uk) {
      log(`Trip "${UK_TRIP.slug}" already exists — leaving it alone.`);
    } else if (DRY) {
      log(`Would create trip "${UK_TRIP.name}" (/t/${UK_TRIP.slug}).`);
    } else {
      uk = (
        await db
          .insert(trips)
          .values({
            slug: UK_TRIP.slug,
            name: UK_TRIP.name,
            destination: UK_TRIP.destination,
            emoji: UK_TRIP.emoji,
            startDate: UK_TRIP.startDate,
            endDate: UK_TRIP.endDate,
            timezone: UK_TRIP.timezone,
            currency: UK_TRIP.currency,
            travelers: UK_TRIP.travelers,
            accent: UK_TRIP.accent,
          })
          .returning()
      )[0];
      log(`Created trip "${UK_TRIP.name}" (/t/${UK_TRIP.slug}).`);
    }

    if (!uk) {
      log("Nothing further to do without the trip. Re-run without --dry.");
      return;
    }

    // --- its legs -------------------------------------------------------
    const existingLegs = await db
      .select()
      .from(legs)
      .where(eq(legs.tripId, uk.id));
    const legIdBySlug = new Map(existingLegs.map((leg) => [leg.slug, leg.id]));

    for (const [index, leg] of UK_TRIP.legs.entries()) {
      if (legIdBySlug.has(leg.slug)) continue;
      if (DRY) {
        log(`Would add leg "${leg.label}".`);
        continue;
      }
      const inserted = await db
        .insert(legs)
        .values({ ...leg, tripId: uk.id, position: index })
        .returning({ id: legs.id });
      legIdBySlug.set(leg.slug, inserted[0].id);
      log(`Added leg "${leg.label}".`);
    }

    // --- its milestones -------------------------------------------------
    const existingMilestones = await db
      .select()
      .from(milestones)
      .where(eq(milestones.tripId, uk.id));

    for (const [index, milestone] of UK_TRIP.milestones.entries()) {
      const already = existingMilestones.some(
        (row) => row.label === milestone.label && row.date === milestone.date,
      );
      if (already) continue;
      if (DRY) {
        log(`Would add milestone "${milestone.label}".`);
        continue;
      }
      await db
        .insert(milestones)
        .values({ ...milestone, tripId: uk.id, position: index });
      log(`Added milestone "${milestone.label}".`);
    }

    // --- the bookings ---------------------------------------------------
    const orphans = await db
      .select()
      .from(segments)
      .where(isNull(segments.tripId));

    if (orphans.length === 0) {
      log("No bookings needed a trip.");
    } else if (DRY) {
      log(`Would file ${orphans.length} booking(s) under "${uk.name}".`);
    } else {
      await db
        .update(segments)
        .set({ tripId: uk.id })
        .where(isNull(segments.tripId));
      log(`Filed ${orphans.length} booking(s) under "${uk.name}".`);
    }

    // Carry the old leg slug across to the new leg row. Done per slug rather
    // than per row so it's a handful of statements however many bookings
    // there are.
    let relinked = 0;
    for (const [slug, legId] of legIdBySlug) {
      const matching = orphans.filter((row) => row.leg === slug).length;
      if (matching === 0) continue;
      if (!DRY) {
        await db
          .update(segments)
          .set({ legId })
          .where(and(eq(segments.tripId, uk.id), eq(segments.leg, slug)));
      }
      relinked += matching;
    }
    log(
      `${DRY ? "Would relink" : "Relinked"} ${relinked} booking(s) to their leg.`,
    );

    // --- the email log --------------------------------------------------
    const looseEmails = await db
      .select({ id: inboundEmails.id })
      .from(inboundEmails)
      .where(isNull(inboundEmails.tripId));

    if (looseEmails.length > 0) {
      if (!DRY) {
        await db
          .update(inboundEmails)
          .set({ tripId: uk.id })
          .where(isNull(inboundEmails.tripId));
      }
      log(
        `${DRY ? "Would attach" : "Attached"} ${looseEmails.length} forwarded email(s) to "${uk.name}".`,
      );
    }

    // --- the new trip ---------------------------------------------------
    if (SEED_SINGAPORE) {
      const existing = await db
        .select({ id: trips.id })
        .from(trips)
        .where(eq(trips.slug, SINGAPORE_TRIP.slug))
        .limit(1);

      if (existing[0]) {
        log(`Trip "${SINGAPORE_TRIP.slug}" already exists — leaving it alone.`);
      } else if (DRY) {
        log(`Would create empty trip "${SINGAPORE_TRIP.name}".`);
      } else {
        await db.insert(trips).values(SINGAPORE_TRIP);
        log(
          `Created empty trip "${SINGAPORE_TRIP.name}" (/t/${SINGAPORE_TRIP.slug}) — ` +
            "add its dates in settings.",
        );
      }
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(trips);
    log(`Done. ${count} trip(s) in the database.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
