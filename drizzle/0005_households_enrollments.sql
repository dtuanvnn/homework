CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "households" ("name") VALUES ('Gia đình');--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_year" smallint NOT NULL,
	"grade" smallint NOT NULL,
	"class_name" text,
	"starts_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_grade_range" CHECK ("enrollments"."grade" between 1 and 12)
);
--> statement-breakpoint
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_student_year_idx" ON "enrollments" USING btree ("student_id","school_year");--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "household_id" uuid;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "lock_reason" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
UPDATE "students" SET "household_id" = (SELECT "id" FROM "households" LIMIT 1);--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "students_household_idx" ON "students" USING btree ("household_id");--> statement-breakpoint
INSERT INTO "enrollments" ("student_id", "school_year", "grade", "class_name", "starts_on")
SELECT s."id", y.year, s."grade", s."class_name", make_date(y.year, 9, 5)
FROM "students" s,
LATERAL (
	SELECT CASE
		WHEN (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= make_date(extract(year FROM now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::int, 9, 5)
		THEN extract(year FROM now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::int
		ELSE extract(year FROM now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::int - 1
	END AS year
) y;--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "grade";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "class_name";--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD COLUMN "household_id" uuid;--> statement-breakpoint
UPDATE "exercise_sets" SET "household_id" = (SELECT "id" FROM "households" LIMIT 1);--> statement-breakpoint
ALTER TABLE "exercise_sets" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "exercise_sets_subject_grade_idx";--> statement-breakpoint
CREATE INDEX "exercise_sets_household_subject_grade_idx" ON "exercise_sets" USING btree ("household_id","subject","grade");--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "household_id" uuid;--> statement-breakpoint
UPDATE "rewards" SET "household_id" = (SELECT "id" FROM "households" LIMIT 1);--> statement-breakpoint
ALTER TABLE "rewards" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD COLUMN "student_id" uuid;--> statement-breakpoint
UPDATE "reward_redemptions" SET "student_id" = (SELECT "id" FROM "students" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
DELETE FROM "reward_redemptions" WHERE "student_id" IS NULL;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ALTER COLUMN "student_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "reward_redemptions_one_pending_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "reward_redemptions_one_pending_idx" ON "reward_redemptions" USING btree ("student_id","reward_id") WHERE "reward_redemptions"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "star_adjustments" ADD COLUMN "student_id" uuid;--> statement-breakpoint
UPDATE "star_adjustments" SET "student_id" = (SELECT "id" FROM "students" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
DELETE FROM "star_adjustments" WHERE "student_id" IS NULL;--> statement-breakpoint
ALTER TABLE "star_adjustments" ALTER COLUMN "student_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "star_adjustments" ADD CONSTRAINT "star_adjustments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_seen" ADD COLUMN "student_id" uuid;--> statement-breakpoint
UPDATE "badge_seen" SET "student_id" = (SELECT "id" FROM "students" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
DELETE FROM "badge_seen" WHERE "student_id" IS NULL;--> statement-breakpoint
ALTER TABLE "badge_seen" ALTER COLUMN "student_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "badge_seen" ADD CONSTRAINT "badge_seen_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_seen" DROP CONSTRAINT "badge_seen_pkey";--> statement-breakpoint
ALTER TABLE "badge_seen" ADD CONSTRAINT "badge_seen_student_id_badge_id_pk" PRIMARY KEY("student_id","badge_id");
