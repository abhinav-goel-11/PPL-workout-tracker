import { ExternalLink, Video } from 'lucide-react';

import type { ExerciseMediaLink } from '@/lib/db/schema';

/**
 * Form references. Opened in a new tab rather than embedded: YouTube and
 * Instagram both refuse to be framed, so an iframe would render an error box.
 */
export function MediaLinks({ links }: { links: ExerciseMediaLink[] }) {
  if (links.length === 0) return null;

  return (
    <ul className='mt-2 flex flex-wrap gap-1.5'>
      {links.map((link) => (
        <li key={link.id}>
          <a
            href={link.url}
            target='_blank'
            rel='noopener noreferrer'
            className='border-border text-muted-foreground hover:border-primary hover:text-primary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors'
          >
            <Video className='size-3' aria-hidden />
            {link.title ?? 'Form video'}
            <ExternalLink className='size-2.5' aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
