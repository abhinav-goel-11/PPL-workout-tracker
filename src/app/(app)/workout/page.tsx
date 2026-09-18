import { redirect } from 'next/navigation';

import { getActiveWorkoutId } from '@/server/queries/workout';
import { requireUser } from '@/server/queries/user';

/**
 * The bottom-nav "Workout" tab. Jumps straight into an in-progress session,
 * otherwise sends you to the dashboard to start the next one in the cycle.
 */
export default async function WorkoutIndexPage() {
  const user = await requireUser();
  const activeId = await getActiveWorkoutId(user.id);

  redirect(activeId ? `/workout/${activeId}` : '/dashboard');
}
