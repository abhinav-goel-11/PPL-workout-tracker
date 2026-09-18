CREATE TYPE "public"."exercise_kind" AS ENUM('normal', 'cardio_superset', 'finisher_circuit', 'tri_set', 'cardio_finisher');--> statement-breakpoint
CREATE TYPE "public"."media_provider" AS ENUM('youtube_short', 'instagram_reel', 'youtube', 'other');--> statement-breakpoint
CREATE TYPE "public"."muscle_group" AS ENUM('chest', 'shoulders', 'triceps', 'back', 'biceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'core', 'cardio');--> statement-breakpoint
CREATE TYPE "public"."rest_kind" AS ENUM('planned', 'active_recovery', 'sick', 'travel');--> statement-breakpoint
CREATE TYPE "public"."split_type" AS ENUM('push', 'pull', 'legs');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('kg', 'lb');--> statement-breakpoint
CREATE TYPE "public"."session_variant" AS ENUM('weekday', 'weekend_expanded');--> statement-breakpoint
CREATE TYPE "public"."workout_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	"requires_reauth" boolean DEFAULT false NOT NULL,
	"scope_granted_at" timestamp with time zone,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "body_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"weight_kg" numeric(5, 2),
	"body_fat_pct" numeric(4, 1),
	"waist_cm" numeric(5, 1),
	"chest_cm" numeric(5, 1),
	"arm_cm" numeric(4, 1),
	"note" text
);
--> statement-breakpoint
CREATE TABLE "exercise_media_links" (
	"id" text PRIMARY KEY NOT NULL,
	"template_exercise_id" text NOT NULL,
	"url" text NOT NULL,
	"provider" "media_provider" DEFAULT 'other' NOT NULL,
	"title" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rest_days" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"kind" "rest_kind" DEFAULT 'planned' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"name" text NOT NULL,
	"split_type" "split_type" NOT NULL,
	"variant" "session_variant" DEFAULT 'weekday' NOT NULL,
	"estimated_minutes" integer DEFAULT 70 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"workout_log_id" text NOT NULL,
	"template_exercise_id" text,
	"user_id" text NOT NULL,
	"performed_on" date NOT NULL,
	"exercise_name" text NOT NULL,
	"muscle_group" "muscle_group" NOT NULL,
	"set_index" integer NOT NULL,
	"weight_kg" numeric(6, 2),
	"reps" integer,
	"duration_seconds" integer,
	"rpe" numeric(3, 1),
	"is_completed" boolean DEFAULT false NOT NULL,
	"is_warmup" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"client_set_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"order_index" integer NOT NULL,
	"name" text NOT NULL,
	"muscle_group" "muscle_group" NOT NULL,
	"kind" "exercise_kind" DEFAULT 'normal' NOT NULL,
	"target_sets" integer DEFAULT 3 NOT NULL,
	"rep_low" integer,
	"rep_high" integer,
	"rest_seconds" integer DEFAULT 90 NOT NULL,
	"is_timed" boolean DEFAULT false NOT NULL,
	"group_key" text,
	"group_position" integer,
	"group_rounds" integer,
	"superset_partner_name" text,
	"superset_duration_seconds" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"time_zone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"week_starts_on" integer DEFAULT 1 NOT NULL,
	"unit" "unit" DEFAULT 'kg' NOT NULL,
	"calendar_sync_enabled" boolean DEFAULT false NOT NULL,
	"calendar_id" text DEFAULT 'primary' NOT NULL,
	"seeded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text NOT NULL,
	"template_ordinal" integer NOT NULL,
	"performed_on" date NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" "workout_status" DEFAULT 'in_progress' NOT NULL,
	"notes" text,
	"calendar_event_id" text
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_metrics" ADD CONSTRAINT "body_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_media_links" ADD CONSTRAINT "exercise_media_links_template_exercise_id_template_exercises_id_fk" FOREIGN KEY ("template_exercise_id") REFERENCES "public"."template_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rest_days" ADD CONSTRAINT "rest_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_templates" ADD CONSTRAINT "session_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_workout_log_id_workout_logs_id_fk" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_template_exercise_id_template_exercises_id_fk" FOREIGN KEY ("template_exercise_id") REFERENCES "public"."template_exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_template_id_session_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."session_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_template_id_session_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."session_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "body_metrics_user_date_uq" ON "body_metrics" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "body_metrics_user_date_idx" ON "body_metrics" USING btree ("user_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "media_links_exercise_idx" ON "exercise_media_links" USING btree ("template_exercise_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "media_links_exercise_url_uq" ON "exercise_media_links" USING btree ("template_exercise_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "rest_days_user_date_uq" ON "rest_days" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "session_templates_user_ordinal_uq" ON "session_templates" USING btree ("user_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "set_logs_slot_uq" ON "set_logs" USING btree ("workout_log_id","template_exercise_id","set_index");--> statement-breakpoint
CREATE INDEX "set_logs_pr_idx" ON "set_logs" USING btree ("user_id","template_exercise_id","performed_on" DESC NULLS LAST) WHERE is_completed and not is_warmup;--> statement-breakpoint
CREATE INDEX "set_logs_volume_idx" ON "set_logs" USING btree ("user_id","performed_on") WHERE is_completed and not is_warmup;--> statement-breakpoint
CREATE INDEX "set_logs_log_idx" ON "set_logs" USING btree ("workout_log_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_exercises_order_uq" ON "template_exercises" USING btree ("template_id","order_index");--> statement-breakpoint
CREATE INDEX "template_exercises_template_idx" ON "template_exercises" USING btree ("template_id","order_index");--> statement-breakpoint
CREATE INDEX "workout_logs_user_date_idx" ON "workout_logs" USING btree ("user_id","performed_on" DESC NULLS LAST,"completed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workout_logs_user_status_idx" ON "workout_logs" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_logs_one_active_uq" ON "workout_logs" USING btree ("user_id") WHERE status = 'in_progress';