ALTER TABLE "tasks" ADD COLUMN "last_scored_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "last_scored_direction" text;