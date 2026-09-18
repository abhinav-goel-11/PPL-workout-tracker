'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CalendarDays, Dumbbell, Home } from 'lucide-react';

import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/dashboard', label: 'Today', icon: Home },
  { href: '/workout', label: 'Workout', icon: Dumbbell },
  { href: '/history', label: 'History', icon: CalendarDays },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label='Primary'
      className='border-border bg-background/95 pb-safe fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-lg'
    >
      <ul className='mx-auto flex w-full max-w-lg items-stretch'>
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className='flex-1'>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className='size-5' strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
