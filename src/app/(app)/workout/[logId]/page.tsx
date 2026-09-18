import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { WorkoutRunner } from '@/components/workout/workout-runner';
import { getWorkoutDetail } from '@/server/queries/workout';
import { requireUser } from '@/server/queries/user';

export const metadata: Metadata = { title: 'Session' };

export default async function WorkoutPage({ params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params;
  const user = await requireUser();

  const detail = await getWorkoutDetail(logId, user.id);
  if (!detail) notFound();

  return (
    <main>
      <WorkoutRunner detail={detail} unit={user.unit} />
    </main>
  );
}
