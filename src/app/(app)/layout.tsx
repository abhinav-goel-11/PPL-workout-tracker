import { BottomNav } from '@/components/app-shell';
import { TimeZoneSync } from '@/components/app-shell/time-zone-sync';
import { requireUser } from '@/server/queries/user';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Authoritative auth boundary: a server component check, not middleware.
  const user = await requireUser();

  return (
    <>
      <div className='mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-6 pb-28'>{children}</div>
      <BottomNav />
      <TimeZoneSync stored={user.timeZone} />
    </>
  );
}
