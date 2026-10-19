CREATE TYPE "public"."exercise_format" AS ENUM('cau-hoi', 'flashcard');--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD COLUMN "format" "exercise_format" DEFAULT 'cau-hoi' NOT NULL;