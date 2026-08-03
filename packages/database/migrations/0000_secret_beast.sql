CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('active', 'merged', 'split', 'expired');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'processing', 'partial', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('manual', 'import', 'telegram');--> statement-breakpoint
CREATE TABLE "admin_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid,
	"justification" text NOT NULL,
	"before" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"after" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anonymous_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"installation_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_installations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"platform" varchar(20) NOT NULL,
	"app_version" varchar(50) NOT NULL,
	"push_target" text,
	"push_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "processing_status" DEFAULT 'pending' NOT NULL,
	"notify_eligible" boolean DEFAULT false NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"provider" varchar(30) NOT NULL,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_subscriptions" (
	"installation_id" uuid PRIMARY KEY NOT NULL,
	"category" varchar(40) DEFAULT 'GPU' NOT NULL,
	"minimum_label" varchar(30) DEFAULT 'boa' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"raw_message_id" uuid NOT NULL,
	"parse_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"mentioned_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"policy_version" varchar(80) NOT NULL,
	"label" varchar(30) NOT NULL,
	"quality_score" integer NOT NULL,
	"confidence" varchar(20) NOT NULL,
	"metrics" jsonb NOT NULL,
	"reasons" jsonb NOT NULL,
	"history_cutoff_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"status" "offer_status" DEFAULT 'active' NOT NULL,
	"merged_into_id" uuid,
	"current_price_in_cents" integer NOT NULL,
	"lowest_price_in_cents" integer NOT NULL,
	"price_bucket_in_cents" integer NOT NULL,
	"coupon" varchar(80),
	"condition" varchar(40) DEFAULT 'unknown' NOT NULL,
	"normalized_url" text,
	"normalized_url_hash" varchar(64),
	"store_product_id" varchar(255),
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"mention_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(80) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"correlation_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"raw_message_id" uuid NOT NULL,
	"amount_in_cents" integer NOT NULL,
	"payment_method" varchar(30) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"normalized_alias" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_key" varchar(100) NOT NULL,
	"category" varchar(40) DEFAULT 'GPU' NOT NULL,
	"vendor" varchar(40) NOT NULL,
	"model" varchar(80) NOT NULL,
	"vram_gb" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_canonical_key_unique" UNIQUE("canonical_key")
);
--> statement-breakpoint
CREATE TABLE "raw_message_parses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_message_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"parser_version" integer NOT NULL,
	"status" "processing_status" NOT NULL,
	"candidate" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"admin_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"import_batch_id" uuid,
	"external_id" varchar(255),
	"idempotency_key" varchar(128) NOT NULL,
	"text" text NOT NULL,
	"original_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"supplied_url" text,
	"captured_at" timestamp with time zone NOT NULL,
	"status" "processing_status" DEFAULT 'pending' NOT NULL,
	"notify_eligible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"kind" "source_kind" NOT NULL,
	"reliability" integer DEFAULT 50 NOT NULL,
	"blocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_reliability_range" CHECK ("sources"."reliability" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(255) NOT NULL,
	"name" varchar(120) NOT NULL,
	"reliability" integer DEFAULT 50 NOT NULL,
	"blocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_domain_unique" UNIQUE("domain"),
	CONSTRAINT "stores_reliability_range" CHECK ("stores"."reliability" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "anonymous_events" ADD CONSTRAINT "anonymous_events_installation_id_device_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."device_installations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_installation_id_device_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."device_installations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_installation_id_device_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."device_installations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_mentions" ADD CONSTRAINT "offer_mentions_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_mentions" ADD CONSTRAINT "offer_mentions_raw_message_id_raw_messages_id_fk" FOREIGN KEY ("raw_message_id") REFERENCES "public"."raw_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_mentions" ADD CONSTRAINT "offer_mentions_parse_id_raw_message_parses_id_fk" FOREIGN KEY ("parse_id") REFERENCES "public"."raw_message_parses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_scores" ADD CONSTRAINT "offer_scores_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_raw_message_id_raw_messages_id_fk" FOREIGN KEY ("raw_message_id") REFERENCES "public"."raw_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_message_parses" ADD CONSTRAINT "raw_message_parses_raw_message_id_raw_messages_id_fk" FOREIGN KEY ("raw_message_id") REFERENCES "public"."raw_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_messages" ADD CONSTRAINT "raw_messages_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_messages" ADD CONSTRAINT "raw_messages_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_entity_idx" ON "admin_audit_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "anonymous_events_installation_time_idx" ON "anonymous_events" USING btree ("installation_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_once_unique" ON "notification_deliveries" USING btree ("installation_id","offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_mentions_message_parse_unique" ON "offer_mentions" USING btree ("raw_message_id","parse_id");--> statement-breakpoint
CREATE INDEX "offer_scores_offer_created_idx" ON "offer_scores" USING btree ("offer_id","created_at");--> statement-breakpoint
CREATE INDEX "offers_feed_idx" ON "offers" USING btree ("status","first_seen_at","id");--> statement-breakpoint
CREATE INDEX "offers_product_time_idx" ON "offers" USING btree ("product_id","first_seen_at");--> statement-breakpoint
CREATE INDEX "offers_store_product_idx" ON "offers" USING btree ("store_id","store_product_id");--> statement-breakpoint
CREATE INDEX "offers_url_hash_idx" ON "offers" USING btree ("normalized_url_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_aggregate_version_unique" ON "outbox_events" USING btree ("topic","aggregate_id","version");--> statement-breakpoint
CREATE INDEX "outbox_unpublished_idx" ON "outbox_events" USING btree ("published_at","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "price_snapshots_observation_unique" ON "price_snapshots" USING btree ("offer_id","raw_message_id","amount_in_cents");--> statement-breakpoint
CREATE INDEX "price_snapshots_offer_time_idx" ON "price_snapshots" USING btree ("offer_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_aliases_alias_unique" ON "product_aliases" USING btree ("normalized_alias");--> statement-breakpoint
CREATE UNIQUE INDEX "products_variant_unique" ON "products" USING btree ("vendor","model","vram_gb");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_message_parses_message_version_unique" ON "raw_message_parses" USING btree ("raw_message_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_messages_source_external_unique" ON "raw_messages" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_messages_idempotency_unique" ON "raw_messages" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "raw_messages_status_captured_idx" ON "raw_messages" USING btree ("status","captured_at");