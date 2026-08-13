import {
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Every bookable/plannable thing on the trip is a "segment". One table keeps
 * the timeline query trivial; `kind` drives how each row renders.
 */
export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** flight | train | hotel | car | ferry | activity | note */
    kind: text("kind").notNull(),

    title: text("title").notNull(),
    vendor: text("vendor"),
    confirmation: text("confirmation"),

    /** Instant the segment starts. Null only for undated notes. */
    startAt: timestamp("start_at", { withTimezone: true }),
    /** IANA zone the start is displayed in (departure airport, hotel city). */
    startTz: text("start_tz").notNull().default("UTC"),

    endAt: timestamp("end_at", { withTimezone: true }),
    /** IANA zone for the end (arrival airport, hotel checkout city). */
    endTz: text("end_tz"),

    /** "SFO" / "The Hoxton, Shoreditch" — free text, shown as the from/to pair. */
    fromLabel: text("from_label"),
    toLabel: text("to_label"),
    /**
     * The city each end of a journey is in ("San Francisco", "London"). An
     * airport code alone is unreadable for anywhere you don't already know, so
     * the card shows the city and keeps the code as the qualifier.
     */
    fromCity: text("from_city"),
    toCity: text("to_city"),
    address: text("address"),

    /**
     * Coordinates for the map view, geocoded once and cached here rather than
     * looked up on every render. A journey has both ends; a stay or a dinner
     * only has `to`, which is treated as its single location.
     */
    fromLat: doublePrecision("from_lat"),
    fromLng: doublePrecision("from_lng"),
    toLat: doublePrecision("to_lat"),
    toLng: doublePrecision("to_lng"),
    /** Set once geocoding has been attempted, so failures aren't retried forever. */
    geocodedAt: timestamp("geocoded_at", { withTimezone: true }),

    /** Which travelers this applies to, e.g. ["xiao","husband"]. */
    travelers: jsonb("travelers").$type<string[]>().notNull().default([]),

    /** Which leg of the trip: london | scotland | residency | beijing | home. */
    leg: text("leg"),

    /** confirmed | pending | cancelled. Email-parsed rows start as pending. */
    status: text("status").notNull().default("confirmed"),

    costAmount: text("cost_amount"),
    costCurrency: text("cost_currency"),

    notes: text("notes"),
    /** Booking URL, boarding pass link, Google Maps pin, etc. */
    link: text("link"),

    /** manual | email */
    source: text("source").notNull().default("manual"),
    sourceEmailId: uuid("source_email_id"),

    /** Kind-specific extras the parser found: flight number, seat, room type... */
    details: jsonb("details")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("segments_start_at_idx").on(table.startAt),
    index("segments_status_idx").on(table.status),
  ],
);

/**
 * Raw forwarded emails. Kept so a bad parse can be re-run or inspected without
 * asking the sender to forward again.
 */
export const inboundEmails = pgTable(
  "inbound_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** postmark | resend | cloudflare | manual */
    provider: text("provider").notNull(),
    /** Provider's message id, used to make redelivery idempotent. */
    externalId: text("external_id"),

    fromAddress: text("from_address"),
    toAddress: text("to_address"),
    subject: text("subject"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    body: text("body").notNull(),

    /** pending | parsed | failed | ignored */
    parseStatus: text("parse_status").notNull().default("pending"),
    parseError: text("parse_error"),
    /** How many segments the parse produced. */
    segmentCount: text("segment_count"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("inbound_emails_external_id_idx").on(table.externalId)],
);

export type Segment = typeof segments.$inferSelect;
export type NewSegment = typeof segments.$inferInsert;
export type InboundEmail = typeof inboundEmails.$inferSelect;
