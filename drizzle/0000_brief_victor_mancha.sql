CREATE TYPE "public"."attachment_kind" AS ENUM('image', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."exercise_kind" AS ENUM('de-thi', 'chu-de', 'luyen-tap');--> statement-breakpoint
CREATE TYPE "public"."exercise_source" AS ENUM('thu-cong', 'tai-len', 'ai');--> statement-breakpoint
CREATE TYPE "public"."exercise_status" AS ENUM('nhap', 'san-sang');--> statement-breakpoint
CREATE TYPE "public"."graded_by" AS ENUM('auto', 'ai', 'parent');--> statement-breakpoint
CREATE TYPE "public"."subject" AS ENUM('toan', 'tieng-viet', 'tieng-anh');--> statement-breakpoint
CREATE TYPE "public"."work_mode" AS ENUM('web', 'paper');--> statement-breakpoint
CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"question" jsonb NOT NULL,
	"response" jsonb,
	"is_correct" boolean,
	"points_awarded" double precision,
	"comment" text
);
--> statement-breakpoint
ALTER TABLE "answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"set_id" uuid NOT NULL,
	"available_from" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"mode" "work_mode" DEFAULT 'web' NOT NULL,
	"max_attempts" smallint DEFAULT 2 NOT NULL,
	"parent_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "max_attempts_range" CHECK ("assignments"."max_attempts" between 1 and 2)
);
--> statement-breakpoint
ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid,
	"attempt_id" uuid,
	"name" text NOT NULL,
	"kind" "attachment_kind" NOT NULL,
	"size_kb" integer NOT NULL,
	"pages" smallint,
	"storage_path" text,
	"external_url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachment_owner" CHECK (("attachments"."set_id" is null) <> ("attachments"."attempt_id" is null))
);
--> statement-breakpoint
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"attempt_no" smallint NOT NULL,
	"mode" "work_mode" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"graded_at" timestamp with time zone,
	"graded_by" "graded_by",
	"duration_seconds" integer,
	"score" double precision,
	"feedback" text,
	"retry_allowed" boolean DEFAULT true NOT NULL,
	CONSTRAINT "attempt_no_range" CHECK ("attempts"."attempt_no" between 1 and 2)
);
--> statement-breakpoint
ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exercise_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subject" "subject" NOT NULL,
	"grade" smallint NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"estimated_minutes" smallint DEFAULT 15 NOT NULL,
	"difficulty" smallint DEFAULT 2 NOT NULL,
	"kind" "exercise_kind" NOT NULL,
	"source" "exercise_source" NOT NULL,
	"status" "exercise_status" DEFAULT 'nhap' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "difficulty_range" CHECK ("exercise_sets"."difficulty" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "exercise_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"content" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"grade" smallint NOT NULL,
	"avatar_emoji" text DEFAULT '🦊' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_set_id_exercise_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."exercise_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_set_id_exercise_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."exercise_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_set_id_exercise_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."exercise_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "answers_attempt_question_idx" ON "answers" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE INDEX "assignments_student_due_idx" ON "assignments" USING btree ("student_id","due_at");--> statement-breakpoint
CREATE INDEX "attachments_set_idx" ON "attachments" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "attachments_attempt_idx" ON "attachments" USING btree ("attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_assignment_no_idx" ON "attempts" USING btree ("assignment_id","attempt_no");--> statement-breakpoint
CREATE INDEX "exercise_sets_subject_grade_idx" ON "exercise_sets" USING btree ("subject","grade");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_set_position_idx" ON "questions" USING btree ("set_id","position");