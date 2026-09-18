import type { ExerciseKind, MediaProvider, MuscleGroup } from '@/lib/db/schema';
import type { SessionOrdinal } from '@/lib/queue/ordinal';

export type SeedMediaLink = {
  url: string;
  provider: MediaProvider;
  title: string;
};

export type SeedExercise = {
  name: string;
  muscleGroup: MuscleGroup;
  kind?: ExerciseKind;
  targetSets: number;
  repLow?: number;
  repHigh?: number;
  restSeconds: number;
  isTimed?: boolean;
  /** Rows sharing this render as one card with a shared rest timer. */
  groupKey?: string;
  groupPosition?: number;
  groupRounds?: number;
  /** Untracked cardio filler — a timer chip, not a set row. */
  supersetPartnerName?: string;
  supersetDurationSeconds?: number;
  notes?: string;
  media?: SeedMediaLink[];
};

export type SeedSession = {
  ordinal: SessionOrdinal;
  name: string;
  splitType: 'push' | 'pull' | 'legs';
  variant: 'weekday' | 'weekend_expanded';
  estimatedMinutes: number;
  exercises: SeedExercise[];
};

/**
 * Seeded links are YouTube *searches*, not specific videos — a real URL that
 * always resolves, rather than a hardcoded video id that can rot or 404.
 * Replace any of them with a specific Short or Reel from Settings.
 */
const search = (q: string, title: string): SeedMediaLink => ({
  url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  provider: 'other',
  title,
});

export const ROUTINE: SeedSession[] = [
  /* ------------------------------ 1 · Push A ------------------------------ */
  {
    ordinal: 1,
    name: 'Push A',
    splitType: 'push',
    variant: 'weekday',
    estimatedMinutes: 70,
    exercises: [
      {
        name: 'Incline DB Press',
        muscleGroup: 'chest',
        targetSets: 3,
        repLow: 8,
        repHigh: 10,
        restSeconds: 90,
        media: [search('incline dumbbell press form', 'Incline DB press — form')],
      },
      {
        name: 'Flat Bench Press (Barbell/DB)',
        muscleGroup: 'chest',
        targetSets: 3,
        repLow: 8,
        repHigh: 10,
        restSeconds: 90,
        media: [search('bench press form technique', 'Bench press — setup & arch')],
      },
      {
        name: 'Seated DB Overhead Press',
        muscleGroup: 'shoulders',
        targetSets: 3,
        repLow: 10,
        repHigh: 12,
        restSeconds: 75,
      },
      {
        name: 'Cable Chest Flyes',
        muscleGroup: 'chest',
        kind: 'cardio_superset',
        targetSets: 3,
        repLow: 12,
        repHigh: 15,
        restSeconds: 60,
        supersetPartnerName: 'Star Jumps',
        supersetDurationSeconds: 45,
        media: [search('star jumps proper form', 'Star jumps — form')],
      },
      {
        name: 'Triceps Rope Pushdowns',
        muscleGroup: 'triceps',
        kind: 'cardio_superset',
        targetSets: 3,
        repLow: 12,
        repHigh: 15,
        restSeconds: 60,
        supersetPartnerName: 'Mountain Climbers',
        supersetDurationSeconds: 45,
        media: [search('mountain climbers proper form', 'Mountain climbers — form')],
      },
      {
        name: 'DB Lateral Raises',
        muscleGroup: 'shoulders',
        targetSets: 3,
        repLow: 15,
        repHigh: 15,
        restSeconds: 60,
      },
    ],
  },

  /* ------------------------------ 2 · Pull A ------------------------------ */
  {
    ordinal: 2,
    name: 'Pull A',
    splitType: 'pull',
    variant: 'weekday',
    estimatedMinutes: 70,
    exercises: [
      {
        name: 'Lat Pulldowns (Wide Grip)',
        muscleGroup: 'back',
        targetSets: 3,
        repLow: 8,
        repHigh: 10,
        restSeconds: 90,
      },
      {
        name: 'Chest-Supported Row (T-Bar/DB)',
        muscleGroup: 'back',
        targetSets: 3,
        repLow: 10,
        repHigh: 12,
        restSeconds: 90,
      },
      {
        name: 'Single-Arm Row',
        muscleGroup: 'back',
        targetSets: 3,
        repLow: 10,
        repHigh: 12,
        restSeconds: 60,
        notes: 'Per arm.',
      },
      {
        name: 'Seated Cable Face Pulls',
        muscleGroup: 'shoulders',
        kind: 'cardio_superset',
        targetSets: 3,
        repLow: 12,
        repHigh: 15,
        restSeconds: 60,
        supersetPartnerName: 'Skater Hops',
        supersetDurationSeconds: 45,
        media: [search('skater hops exercise form', 'Skater hops — form')],
      },
      {
        name: 'Incline DB Curls',
        muscleGroup: 'biceps',
        kind: 'cardio_superset',
        targetSets: 3,
        repLow: 10,
        repHigh: 12,
        restSeconds: 60,
        supersetPartnerName: 'Jump Rope / Burpees',
        supersetDurationSeconds: 45,
        media: [search('burpee proper form', 'Burpees — form')],
      },
      {
        name: 'Hammer Curls',
        muscleGroup: 'biceps',
        targetSets: 3,
        repLow: 12,
        repHigh: 15,
        restSeconds: 60,
      },
    ],
  },

  /* ------------------------------ 3 · Legs A ------------------------------ */
  {
    ordinal: 3,
    name: 'Legs A',
    splitType: 'legs',
    variant: 'weekday',
    estimatedMinutes: 70,
    exercises: [
      {
        name: 'Barbell/Goblet Squats',
        muscleGroup: 'quads',
        targetSets: 3,
        repLow: 8,
        repHigh: 10,
        restSeconds: 90,
        media: [search('squat depth form technique', 'Squat — depth & bracing')],
      },
      {
        name: 'Romanian Deadlifts (RDLs)',
        muscleGroup: 'hamstrings',
        targetSets: 3,
        repLow: 8,
        repHigh: 10,
        restSeconds: 90,
        media: [search('romanian deadlift form', 'RDL — hinge pattern')],
      },
      {
        name: 'Leg Press',
        muscleGroup: 'quads',
        targetSets: 3,
        repLow: 10,
        repHigh: 12,
        restSeconds: 75,
      },
      {
        name: 'Leg Curls',
        muscleGroup: 'hamstrings',
        kind: 'cardio_superset',
        targetSets: 3,
        repLow: 12,
        repHigh: 15,
        restSeconds: 60,
        supersetPartnerName: 'Bodyweight Squat Jumps',
        supersetDurationSeconds: 45,
        media: [search('squat jump form', 'Squat jumps — landing mechanics')],
      },
      {
        name: 'Standing Calf Raises',
        muscleGroup: 'calves',
        targetSets: 3,
        repLow: 15,
        repHigh: 15,
        restSeconds: 60,
      },
    ],
  },

  /* ------------------------------ 4 · Push B ------------------------------ */
  {
    ordinal: 4,
    name: 'Push B',
    splitType: 'push',
    variant: 'weekday',
    estimatedMinutes: 70,
    exercises: [
      {
        name: 'Overhead DB Press',
        muscleGroup: 'shoulders',
        targetSets: 3,
        repLow: 8,
        repHigh: 10,
        restSeconds: 90,
      },
      {
        name: 'Incline DB Press / Cable Crossover',
        muscleGroup: 'chest',
        targetSets: 3,
        repLow: 10,
        repHigh: 12,
        restSeconds: 75,
      },
      {
        name: 'DB Lateral Raises',
        muscleGroup: 'shoulders',
        kind: 'cardio_superset',
        targetSets: 3,
        repLow: 12,
        repHigh: 15,
        restSeconds: 60,
        supersetPartnerName: 'Star Jumps',
        supersetDurationSeconds: 45,
      },
      {
        name: 'Rear Delt Flyes',
        muscleGroup: 'shoulders',
        kind: 'cardio_superset',
        targetSets: 3,
        repLow: 12,
        repHigh: 15,
        restSeconds: 60,
        supersetPartnerName: 'Mountain Climbers',
        supersetDurationSeconds: 45,
      },
      {
        name: 'Skullcrushers + Overhead Extensions',
        muscleGroup: 'triceps',
        targetSets: 3,
        repLow: 12,
        repHigh: 12,
        restSeconds: 60,
        notes: 'Run as a pair: skullcrushers straight into overhead extensions.',
      },
    ],
  },

  /* ------------------------ 5 · Pull B (weekend) -------------------------- */
  {
    ordinal: 5,
    name: 'Pull B',
    splitType: 'pull',
    variant: 'weekend_expanded',
    estimatedMinutes: 88,
    exercises: [
      {
        name: 'Bent-Over Barbell or Landmine Rows',
        muscleGroup: 'back',
        targetSets: 4,
        repLow: 8,
        repHigh: 10,
        restSeconds: 90,
        media: [search('bent over barbell row form', 'Bent-over row — form')],
      },
      {
        name: 'Close-Grip V-Bar Lat Pulldowns',
        muscleGroup: 'back',
        targetSets: 4,
        repLow: 8,
        repHigh: 10,
        restSeconds: 90,
      },
      {
        name: 'Straight-Arm Cable Lat Pushdowns',
        muscleGroup: 'back',
        targetSets: 3,
        repLow: 12,
        repHigh: 15,
        restSeconds: 60,
      },
      {
        name: 'High Cable Face Pulls',
        muscleGroup: 'shoulders',
        targetSets: 3,
        repLow: 15,
        repHigh: 15,
        restSeconds: 60,
      },
      // Bicep Tri-Set — tracked movements sharing one card and one rest timer.
      {
        name: 'Preacher Curls',
        muscleGroup: 'biceps',
        kind: 'tri_set',
        targetSets: 3,
        repLow: 10,
        repHigh: 10,
        restSeconds: 90,
        groupKey: 'pull-b-bicep-tri-set',
        groupPosition: 0,
      },
      {
        name: 'Cable Curls',
        muscleGroup: 'biceps',
        kind: 'tri_set',
        targetSets: 3,
        repLow: 12,
        repHigh: 12,
        restSeconds: 90,
        groupKey: 'pull-b-bicep-tri-set',
        groupPosition: 1,
      },
      // Weekend Finisher Circuit — 3 rounds through all three, timed.
      {
        name: 'Treadmill Sprint / Row',
        muscleGroup: 'cardio',
        kind: 'finisher_circuit',
        targetSets: 3,
        restSeconds: 60,
        isTimed: true,
        groupKey: 'pull-b-finisher',
        groupPosition: 0,
        groupRounds: 3,
        notes: '1 minute.',
      },
      {
        name: 'Woodchoppers',
        muscleGroup: 'core',
        kind: 'finisher_circuit',
        targetSets: 3,
        restSeconds: 60,
        isTimed: true,
        groupKey: 'pull-b-finisher',
        groupPosition: 1,
        groupRounds: 3,
        notes: '1 minute.',
        media: [search('cable woodchopper form', 'Woodchoppers — form')],
      },
      {
        name: 'Planks',
        muscleGroup: 'core',
        kind: 'finisher_circuit',
        targetSets: 3,
        restSeconds: 60,
        isTimed: true,
        groupKey: 'pull-b-finisher',
        groupPosition: 2,
        groupRounds: 3,
        notes: '1 minute.',
      },
    ],
  },

  /* ------------------------ 6 · Legs B (weekend) -------------------------- */
  {
    ordinal: 6,
    name: 'Legs B',
    splitType: 'legs',
    variant: 'weekend_expanded',
    estimatedMinutes: 88,
    exercises: [
      {
        name: 'DB Walking Lunges',
        muscleGroup: 'quads',
        targetSets: 4,
        repLow: 10,
        repHigh: 10,
        restSeconds: 90,
        notes: 'Per leg.',
      },
      {
        name: 'Leg Extensions',
        muscleGroup: 'quads',
        targetSets: 4,
        repLow: 12,
        repHigh: 15,
        restSeconds: 75,
      },
      {
        name: 'Seated Hamstring Curls',
        muscleGroup: 'hamstrings',
        targetSets: 4,
        repLow: 10,
        repHigh: 12,
        restSeconds: 75,
      },
      {
        name: 'Seated Calf Raises',
        muscleGroup: 'calves',
        targetSets: 4,
        repLow: 15,
        repHigh: 15,
        restSeconds: 60,
      },
      // Dedicated Core Circuit.
      {
        name: 'Hanging Leg Raises',
        muscleGroup: 'core',
        kind: 'finisher_circuit',
        targetSets: 3,
        repLow: 15,
        repHigh: 15,
        restSeconds: 60,
        groupKey: 'legs-b-core',
        groupPosition: 0,
      },
      {
        name: 'Cable Crunches',
        muscleGroup: 'core',
        kind: 'finisher_circuit',
        targetSets: 3,
        repLow: 15,
        repHigh: 15,
        restSeconds: 60,
        groupKey: 'legs-b-core',
        groupPosition: 1,
      },
      {
        name: 'Russian Twists',
        muscleGroup: 'core',
        kind: 'finisher_circuit',
        targetSets: 3,
        repLow: 20,
        repHigh: 20,
        restSeconds: 60,
        groupKey: 'legs-b-core',
        groupPosition: 2,
      },
      {
        name: 'Incline Treadmill Walk',
        muscleGroup: 'cardio',
        kind: 'cardio_finisher',
        targetSets: 1,
        restSeconds: 0,
        isTimed: true,
        notes: '15 minutes at 10–12% incline, 4.5–5 km/h.',
        media: [search('incline treadmill walk fat loss form', 'Incline walk — setup')],
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*                          Warmup & cooldown checklists                       */
/* -------------------------------------------------------------------------- */

export type ChecklistItem = { id: string; label: string; detail?: string };

export const WARMUP: { title: string; minutes: number; items: ChecklistItem[] } = {
  title: 'Universal Dynamic Warmup',
  minutes: 8,
  items: [
    { id: 'w1', label: 'Light cardio', detail: '3 min — bike, row or brisk incline walk' },
    { id: 'w2', label: 'Leg swings', detail: '10 each — front-to-back, side-to-side' },
    { id: 'w3', label: 'Arm circles & band pull-aparts', detail: '15 each' },
    { id: 'w4', label: 'Cat-cow + thoracic rotations', detail: '8 each side' },
    { id: 'w5', label: 'Hip openers / world’s greatest stretch', detail: '5 each side' },
    { id: 'w6', label: 'Bodyweight ramp-up', detail: '10 squats, 10 push-ups' },
    { id: 'w7', label: 'Two ramping warmup sets', detail: 'On the first compound only' },
  ],
};

export const COOLDOWN: { title: string; minutes: number; items: ChecklistItem[] } = {
  title: 'Post-Workout Static Stretching',
  minutes: 5,
  items: [
    { id: 'c1', label: 'Chest / doorway stretch', detail: '30s each side' },
    { id: 'c2', label: 'Lat hang or wall lat stretch', detail: '30s each side' },
    { id: 'c3', label: 'Hamstring stretch', detail: '30s each side' },
    { id: 'c4', label: 'Hip flexor / couch stretch', detail: '30s each side' },
    { id: 'c5', label: 'Quad stretch', detail: '30s each side' },
    { id: 'c6', label: 'Calf stretch on a step', detail: '30s each side' },
    { id: 'c7', label: 'Child’s pose + slow breathing', detail: '60s' },
  ],
};
