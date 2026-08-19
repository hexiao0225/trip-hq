import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A trip: one journey with its own legs, milestones and bookings.
 *
 * Trips used to live in `src/lib/config.ts` as a hand-edited constant, which
 * only works while there is exactly one of them. They are rows now, so a new
 * destination is a form rather than a deploy.
 */
export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** URL segment, e.g. "uk" in /t/uk. Lowercase, unique. */
    slug: text("slug").notNull(),

    /** "UK & Beijing" — what the switcher shows. */
    name: text("name").notNull(),
    /** "London → Scotland → Beijing", shown under the name. */
    destination: text("destination"),
    /** One emoji, used as the trip's mark in the switcher and the trip list. */
    emoji: text("emoji"),

    /** Trip bounds as plain YYYY-MM-DD. Null while still being planned. */
    startDate: text("start_date"),
    endDate: text("end_date"),

    /** Default IANA zone for new bookings on this trip. */
    timezone: text("timezone").notNull().default("UTC"),
    /** Default currency for the cost field, e.g. "GBP". */
    currency: text("currency"),

    /** Who is going, as companion ids: ["xiao","hanyang"]. */
    travelers: jsonb("travelers").$type<string[]>().notNull().default([]),

    /** Tint key from `src/lib/accents.ts`, e.g. "indigo". */
    accent: text("accent").notNull().default("stone"),

    notes: text("notes"),

    /** Set to hide a finished trip from the switcher without deleting it. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("trips_slug_idx").on(table.slug),
    index("trips_start_date_idx").on(table.startDate),
  ],
);

/**
 * A stretch of one trip — "London", "Scotland", "the residency". The timeline
 * groups days under these, and each carries the timezone that stretch is lived
 * in, which is what makes a form default to Asia/Singapore rather than UTC.
 */
export const legs = pgTable(
  "legs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),

    /** Stable per-trip key, kept so imported segments can be matched by name. */
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    /** "London, UK" — where this leg happens. */
    place: text("place"),
    timezone: text("timezone").notNull().default("UTC"),

    /** Inclusive YYYY-MM-DD bounds. Null means "not decided yet". */
    startDate: text("start_date"),
    endDate: text("end_date"),

    /** Who is on this leg. Empty means everyone on the trip. */
    travelers: jsonb("travelers").$type<string[]>().notNull().default([]),

    /** Tint key from `src/lib/accents.ts`. */
    accent: text("accent").notNull().default("stone"),

    /** Manual order, used when legs have no dates to sort by. */
    position: integer("position").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("legs_trip_slug_idx").on(table.tripId, table.slug),
    index("legs_trip_idx").on(table.tripId),
  ],
);

/** A fixed point a trip is planned around, shown as a countdown card. */
export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),

    label: text("label").notNull(),
    /** YYYY-MM-DD, read in `timezone`. */
    date: text("date").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    who: jsonb("who").$type<string[]>().notNull().default([]),
    position: integer("position").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("milestones_trip_idx").on(table.tripId)],
);

/**
 * Every bookable/plannable thing on a trip is a "segment". One table keeps
 * the timeline query trivial; `kind` drives how each row renders.
 */
export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Which trip this belongs to.
     *
     * Nullable, and null means "not filed yet" rather than "no trip": a
     * forwarded email that can't be matched to a trip confidently lands in
     * Review unassigned, where it's given one by hand. Making it NOT NULL
     * would also stop `db:push` adding the column to a table that has rows.
     */
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "cascade" }),

    /** Which leg of the trip. Null falls back to matching on the date. */
    legId: uuid("leg_id").references(() => legs.id, { onDelete: "set null" }),

    /** flight | train | hotel | car | ferry | activity | dining | pet | note */
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

    /** Which travelers this applies to, e.g. ["xiao","hanyang"]. */
    travelers: jsonb("travelers").$type<string[]>().notNull().default([]),

    /**
     * The leg slug this row was filed under before legs became rows.
     *
     * Read only by `scripts/migrate-multi-trip.ts`, to point each booking at
     * the leg row that replaced its slug. Nothing writes it any more, and
     * `legId` is what the app reads — but dropping the column would strand
     * any database that hasn't been migrated yet.
     */
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
    index("segments_trip_idx").on(table.tripId, table.startAt),
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

    /** Trip the parse filed this email's bookings under, once it knows. */
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "set null" }),

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

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type Leg = typeof legs.$inferSelect;
export type NewLeg = typeof legs.$inferInsert;
export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;
export type Segment = typeof segments.$inferSelect;
export type NewSegment = typeof segments.$inferInsert;
export type InboundEmail = typeof inboundEmails.$inferSelect;
