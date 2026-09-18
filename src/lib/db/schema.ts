import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from 'next-auth/adapters';

const cuid = () => crypto.randomUUID();

/* -------------------------------------------------------------------------- */
/*                                   Enums                                     */
/* -------------------------------------------------------------------------- */

export const unitEnum = pgEnum('unit', ['kg', 'lb']);

export const splitTypeEnum = pgEnum('split_type', ['push', 'pull', 'legs']);

export const variantEnum = pgEnum('session_variant', ['weekday', 'weekend_expanded']);

/**
 * Drives styling only — rose treatment for the cardio kinds. Structural
 * grouping (tri-sets, circuits) is expressed with `groupKey`, not with this.
 */
export const exerciseKindEnum = pgEnum('exercise_kind', [
  'normal',
  'cardio_superset',
  'finisher_circuit',
  'tri_set',
  'cardio_finisher',
]);

export const muscleGroupEnum = pgEnum('muscle_group', [
  'chest',
  'shoulders',
  'triceps',
  'back',
  'biceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'cardio',
]);

export const workoutStatusEnum = pgEnum('workout_status', [
  'in_progress',
  'completed',
  'abandoned',
]);

export const restKindEnum = pgEnum('rest_kind', ['planned', 'active_recovery', 'sick', 'travel']);

export const mediaProviderEnum = pgEnum('media_provider', [
  'youtube_short',
  'instagram_reel',
  'youtube',
  'other',
]);

/* -------------------------------------------------------------------------- */
/*                              Auth.js adapter                                */
/* -------------------------------------------------------------------------- */

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(cuid),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),

  // ---- app columns ----
  /** IANA zone. Every "today" is resolved through this, never through UTC. */
  timeZone: text('time_zone').notNull().default('Asia/Kolkata'),
  /** 1 = Monday (ISO). Drives week bucketing in analytics. */
  weekStartsOn: integer('week_starts_on').notNull().default(1),
  /** Display unit only — weights are always stored in kg. */
  unit: unitEnum('unit').notNull().default('kg'),
  calendarSyncEnabled: boolean('calendar_sync_enabled').notNull().default(false),
  calendarId: text('calendar_id').notNull().default('primary'),
  /** Set once the 6 PPL templates have been cloned for this user. */
  seededAt: timestamp('seeded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),

    // ---- app columns ----
    /** Set when Google returns invalid_grant; drives the "Reconnect" card. */
    requiresReauth: boolean('requires_reauth').notNull().default(false),
    /** When the calendar scope was last granted (incremental auth). */
    scopeGrantedAt: timestamp('scope_granted_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index('accounts_user_idx').on(t.userId),
  ],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* -------------------------------------------------------------------------- */
/*                            Routine templates                                */
/* -------------------------------------------------------------------------- */

/**
 * Seeded per user on first sign-in, which is what makes routines editable
 * without a global-template + fork-on-edit split.
 */
export const sessionTemplates = pgTable(
  'session_templates',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Position in the rolling cycle, 1..6. */
    ordinal: integer('ordinal').notNull(),
    name: text('name').notNull(),
    splitType: splitTypeEnum('split_type').notNull(),
    variant: variantEnum('variant').notNull().default('weekday'),
    estimatedMinutes: integer('estimated_minutes').notNull().default(70),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('session_templates_user_ordinal_uq').on(t.userId, t.ordinal)],
);

export const templateExercises = pgTable(
  'template_exercises',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    templateId: text('template_id')
      .notNull()
      .references(() => sessionTemplates.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull(),
    name: text('name').notNull(),
    muscleGroup: muscleGroupEnum('muscle_group').notNull(),
    kind: exerciseKindEnum('kind').notNull().default('normal'),
    targetSets: integer('target_sets').notNull().default(3),
    repLow: integer('rep_low'),
    repHigh: integer('rep_high'),
    restSeconds: integer('rest_seconds').notNull().default(90),
    /** Logged as duration rather than weight x reps (planks, treadmill). */
    isTimed: boolean('is_timed').notNull().default(false),

    /**
     * Rows sharing a groupKey inside one template render as a single card
     * (tri-set, finisher circuit) and share one rest timer that arms only
     * after the last groupPosition.
     */
    groupKey: text('group_key'),
    groupPosition: integer('group_position'),
    /** Rounds through the whole group, for circuits. */
    groupRounds: integer('group_rounds'),

    /** Untracked cardio filler — a timer chip, no set rows. */
    supersetPartnerName: text('superset_partner_name'),
    supersetDurationSeconds: integer('superset_duration_seconds'),

    notes: text('notes'),
  },
  (t) => [
    uniqueIndex('template_exercises_order_uq').on(t.templateId, t.orderIndex),
    index('template_exercises_template_idx').on(t.templateId, t.orderIndex),
  ],
);

export const exerciseMediaLinks = pgTable(
  'exercise_media_links',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    templateExerciseId: text('template_exercise_id')
      .notNull()
      .references(() => templateExercises.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    provider: mediaProviderEnum('provider').notNull().default('other'),
    title: text('title'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('media_links_exercise_idx').on(t.templateExerciseId, t.position),
    uniqueIndex('media_links_exercise_url_uq').on(t.templateExerciseId, t.url),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                   Logs                                      */
/* -------------------------------------------------------------------------- */

export const workoutLogs = pgTable(
  'workout_logs',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    templateId: text('template_id')
      .notNull()
      .references(() => sessionTemplates.id, { onDelete: 'cascade' }),
    /**
     * Denormalised so the queue derivation needs no join, and so editing a
     * template later cannot rewrite history.
     */
    templateOrdinal: integer('template_ordinal').notNull(),
    /** Local calendar date as 'YYYY-MM-DD' — never a Date, to avoid tz drift. */
    performedOn: date('performed_on', { mode: 'string' }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: workoutStatusEnum('status').notNull().default('in_progress'),
    notes: text('notes'),
    calendarEventId: text('calendar_event_id'),
  },
  (t) => [
    index('workout_logs_user_date_idx').on(t.userId, t.performedOn.desc(), t.completedAt.desc()),
    index('workout_logs_user_status_idx').on(t.userId, t.status),
    /** At most one active workout per user — stops double-tapped Start racing. */
    uniqueIndex('workout_logs_one_active_uq')
      .on(t.userId)
      .where(sql`status = 'in_progress'`),
  ],
);

export const setLogs = pgTable(
  'set_logs',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    workoutLogId: text('workout_log_id')
      .notNull()
      .references(() => workoutLogs.id, { onDelete: 'cascade' }),
    templateExerciseId: text('template_exercise_id').references(() => templateExercises.id, {
      onDelete: 'set null',
    }),

    /** Denormalised so analytics and PR lookups never join workout_logs. */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    performedOn: date('performed_on', { mode: 'string' }).notNull(),
    exerciseName: text('exercise_name').notNull(),
    muscleGroup: muscleGroupEnum('muscle_group').notNull(),

    setIndex: integer('set_index').notNull(),
    weightKg: numeric('weight_kg', { precision: 6, scale: 2, mode: 'number' }),
    reps: integer('reps'),
    durationSeconds: integer('duration_seconds'),
    rpe: numeric('rpe', { precision: 3, scale: 1, mode: 'number' }),
    isCompleted: boolean('is_completed').notNull().default(false),
    isWarmup: boolean('is_warmup').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    /** Client-generated id, so an offline replay is traceable end-to-end. */
    clientSetId: text('client_set_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** Idempotency key: every set write upserts on this. */
    uniqueIndex('set_logs_slot_uq').on(t.workoutLogId, t.templateExerciseId, t.setIndex),
    index('set_logs_pr_idx')
      .on(t.userId, t.templateExerciseId, t.performedOn.desc())
      .where(sql`is_completed and not is_warmup`),
    index('set_logs_volume_idx')
      .on(t.userId, t.performedOn)
      .where(sql`is_completed and not is_warmup`),
    index('set_logs_log_idx').on(t.workoutLogId),
  ],
);

export const restDays = pgTable(
  'rest_days',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    kind: restKindEnum('kind').notNull().default('planned'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('rest_days_user_date_uq').on(t.userId, t.date)],
);

export const bodyMetrics = pgTable(
  'body_metrics',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    weightKg: numeric('weight_kg', { precision: 5, scale: 2, mode: 'number' }),
    bodyFatPct: numeric('body_fat_pct', { precision: 4, scale: 1, mode: 'number' }),
    waistCm: numeric('waist_cm', { precision: 5, scale: 1, mode: 'number' }),
    chestCm: numeric('chest_cm', { precision: 5, scale: 1, mode: 'number' }),
    armCm: numeric('arm_cm', { precision: 4, scale: 1, mode: 'number' }),
    note: text('note'),
  },
  (t) => [
    uniqueIndex('body_metrics_user_date_uq').on(t.userId, t.date),
    index('body_metrics_user_date_idx').on(t.userId, t.date.desc()),
  ],
);

/* -------------------------------------------------------------------------- */
/*                              Inferred types                                 */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type SessionTemplate = typeof sessionTemplates.$inferSelect;
export type TemplateExercise = typeof templateExercises.$inferSelect;
export type ExerciseMediaLink = typeof exerciseMediaLinks.$inferSelect;
export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type SetLog = typeof setLogs.$inferSelect;
export type RestDay = typeof restDays.$inferSelect;
export type BodyMetric = typeof bodyMetrics.$inferSelect;

export type ExerciseKind = (typeof exerciseKindEnum.enumValues)[number];
export type MuscleGroup = (typeof muscleGroupEnum.enumValues)[number];
export type WorkoutStatus = (typeof workoutStatusEnum.enumValues)[number];
export type RestKind = (typeof restKindEnum.enumValues)[number];
export type MediaProvider = (typeof mediaProviderEnum.enumValues)[number];
