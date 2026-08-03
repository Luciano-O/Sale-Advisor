CREATE TABLE "url_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_message_id" uuid NOT NULL,
	"original_url" text NOT NULL,
	"original_url_hash" varchar(64) NOT NULL,
	"final_url" text,
	"redirect_chain" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(20) NOT NULL,
	"status_http" integer,
	"resolver_version" varchar(40) NOT NULL,
	"pipeline_version" integer DEFAULT 1 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" jsonb,
	"resolved_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "price_snapshots_observation_unique";--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD COLUMN "parse_id" uuid;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "raw_message_parses" ADD COLUMN "url_resolution_id" uuid;--> statement-breakpoint
UPDATE "price_snapshots" ps SET "parse_id" = (
	SELECT om."parse_id" FROM "offer_mentions" om
	WHERE om."raw_message_id" = ps."raw_message_id" AND om."offer_id" = ps."offer_id"
	ORDER BY om."created_at" DESC LIMIT 1
) WHERE ps."parse_id" IS NULL;--> statement-breakpoint
ALTER TABLE "url_resolutions" ADD CONSTRAINT "url_resolutions_raw_message_id_raw_messages_id_fk" FOREIGN KEY ("raw_message_id") REFERENCES "public"."raw_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "url_resolutions_message_url_version_unique" ON "url_resolutions" USING btree ("raw_message_id","original_url_hash","resolver_version","pipeline_version");--> statement-breakpoint
CREATE INDEX "url_resolutions_cache_idx" ON "url_resolutions" USING btree ("original_url_hash","resolver_version","status","expires_at");--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_parse_id_raw_message_parses_id_fk" FOREIGN KEY ("parse_id") REFERENCES "public"."raw_message_parses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_message_parses" ADD CONSTRAINT "raw_message_parses_url_resolution_id_url_resolutions_id_fk" FOREIGN KEY ("url_resolution_id") REFERENCES "public"."url_resolutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "price_snapshots_observation_unique" ON "price_snapshots" USING btree ("offer_id","raw_message_id","parse_id","amount_in_cents");
