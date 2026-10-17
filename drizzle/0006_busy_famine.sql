ALTER TABLE "attempts" ADD COLUMN "offline_id" uuid;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "submitted_offline" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "auto_settled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "offline_set_changed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_offline_id_idx" ON "attempts" USING btree ("offline_id");