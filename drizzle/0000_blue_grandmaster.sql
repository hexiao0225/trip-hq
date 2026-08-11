CREATE TABLE "inbound_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_id" text,
	"from_address" text,
	"to_address" text,
	"subject" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"body" text NOT NULL,
	"parse_status" text DEFAULT 'pending' NOT NULL,
	"parse_error" text,
	"segment_count" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"vendor" text,
	"confirmation" text,
	"start_at" timestamp with time zone,
	"start_tz" text DEFAULT 'UTC' NOT NULL,
	"end_at" timestamp with time zone,
	"end_tz" text,
	"from_label" text,
	"to_label" text,
	"address" text,
	"travelers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"leg" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"cost_amount" text,
	"cost_currency" text,
	"notes" text,
	"link" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_email_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_emails_external_id_idx" ON "inbound_emails" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "segments_start_at_idx" ON "segments" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "segments_status_idx" ON "segments" USING btree ("status");