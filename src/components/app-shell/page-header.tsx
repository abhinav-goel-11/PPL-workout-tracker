import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className='mb-5 flex items-start justify-between gap-4'>
      <div className='min-w-0'>
        <h1 className='truncate text-2xl font-semibold tracking-tight'>{title}</h1>
        {subtitle ? <p className='text-muted-foreground mt-1 text-sm'>{subtitle}</p> : null}
      </div>
      {action ? <div className='shrink-0'>{action}</div> : null}
    </header>
  );
}
