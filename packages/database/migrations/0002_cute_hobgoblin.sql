CREATE TYPE "public"."collector_role" AS ENUM('active', 'standby');--> statement-breakpoint
CREATE TYPE "public"."collector_state" AS ENUM('starting', 'healthy', 'retrying', 'blocked', 'stopped');--> statement-breakpoint
CREATE TABLE "collector_instances" (
	"instance_id" varchar(120) PRIMARY KEY NOT NULL,
	"integration_kind" varchar(40) NOT NULL,
	"role" "collector_role" DEFAULT 'standby' NOT NULL,
	"state" "collector_state" DEFAULT 'starting' NOT NULL,
	"heartbeat_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"last_error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "collector_instances_health_idx" ON "collector_instances" USING btree ("integration_kind","role","heartbeat_at");