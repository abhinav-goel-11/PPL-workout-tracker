'use client';

import { useState, useTransition } from 'react';
import { Check, Link2, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KindBadge } from '@/components/workout/kind-badge';
import { SplitBadge, type SplitType } from '@/components/split-badge';
import { addMediaLink, deleteMediaLink } from '@/server/actions/media';
import { updateTemplateExercise } from '@/server/actions/routine';
import type { RoutineSession } from '@/server/queries/settings';

type Exercise = RoutineSession['exercises'][number];

function ExerciseEditor({ exercise }: { exercise: Exercise }) {
  const [pending, startTransition] = useTransition();
  const [sets, setSets] = useState(String(exercise.targetSets));
  const [low, setLow] = useState(exercise.repLow?.toString() ?? '');
  const [high, setHigh] = useState(exercise.repHigh?.toString() ?? '');
  const [rest, setRest] = useState(String(exercise.restSeconds));
  const [url, setUrl] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);

  function save() {
    startTransition(async () => {
      const result = await updateTemplateExercise({
        id: exercise.id,
        targetSets: Number(sets),
        repLow: low === '' ? null : Number(low),
        repHigh: high === '' ? null : Number(high),
        restSeconds: Number(rest),
      });

      if (!result.ok) {
        toast.error(result.error ?? 'Could not save.');
        return;
      }
      toast.success(`${exercise.name} updated.`);
    });
  }

  function saveLink() {
    startTransition(async () => {
      const result = await addMediaLink({ templateExerciseId: exercise.id, url });
      if (!result.ok) {
        toast.error(result.error ?? 'Could not add that link.');
        return;
      }
      toast.success('Form video added.');
      setUrl('');
      setShowLinkForm(false);
    });
  }

  return (
    <div className='border-border border-t py-3 first:border-t-0'>
      <div className='flex flex-wrap items-center gap-2'>
        <p className='text-sm font-medium'>{exercise.name}</p>
        <KindBadge kind={exercise.kind} />
      </div>

      <div className='mt-2 grid grid-cols-4 gap-2'>
        <div>
          <Label htmlFor={`${exercise.id}-sets`} className='text-[10px]'>
            Sets
          </Label>
          <Input
            id={`${exercise.id}-sets`}
            type='number'
            inputMode='numeric'
            className='mt-1 h-9 text-center'
            value={sets}
            onChange={(e) => setSets(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`${exercise.id}-low`} className='text-[10px]'>
            Rep min
          </Label>
          <Input
            id={`${exercise.id}-low`}
            type='number'
            inputMode='numeric'
            className='mt-1 h-9 text-center'
            value={low}
            onChange={(e) => setLow(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`${exercise.id}-high`} className='text-[10px]'>
            Rep max
          </Label>
          <Input
            id={`${exercise.id}-high`}
            type='number'
            inputMode='numeric'
            className='mt-1 h-9 text-center'
            value={high}
            onChange={(e) => setHigh(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`${exercise.id}-rest`} className='text-[10px]'>
            Rest (s)
          </Label>
          <Input
            id={`${exercise.id}-rest`}
            type='number'
            inputMode='numeric'
            className='mt-1 h-9 text-center'
            value={rest}
            onChange={(e) => setRest(e.target.value)}
          />
        </div>
      </div>

      {exercise.media.length > 0 ? (
        <ul className='mt-2 flex flex-col gap-1'>
          {exercise.media.map((link) => (
            <li key={link.id} className='flex items-center gap-2'>
              <a
                href={link.url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-muted-foreground hover:text-primary min-w-0 flex-1 truncate text-xs'
              >
                {link.title ?? link.url}
              </a>
              <button
                type='button'
                aria-label={`Remove ${link.title ?? 'link'}`}
                className='text-muted-foreground hover:text-destructive'
                onClick={() =>
                  startTransition(async () => {
                    await deleteMediaLink(link.id);
                    toast('Link removed.');
                  })
                }
              >
                <Trash2 className='size-3.5' aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showLinkForm ? (
        <div className='mt-2 flex gap-2'>
          <Input
            type='url'
            placeholder='https://youtube.com/shorts/…'
            className='h-9 text-xs'
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button size='sm' onClick={saveLink} disabled={pending || url === ''}>
            <Check className='size-4' aria-hidden />
          </Button>
          <Button size='sm' variant='ghost' onClick={() => setShowLinkForm(false)}>
            <X className='size-4' aria-hidden />
          </Button>
        </div>
      ) : null}

      <div className='mt-2 flex gap-2'>
        <Button size='sm' variant='secondary' className='flex-1' onClick={save} disabled={pending}>
          {pending ? <Loader2 className='size-3.5 animate-spin' aria-hidden /> : null}
          Save
        </Button>
        {!showLinkForm ? (
          <Button
            size='sm'
            variant='ghost'
            className='text-muted-foreground'
            onClick={() => setShowLinkForm(true)}
          >
            <Link2 className='size-3.5' aria-hidden />
            Add form video
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function RoutineEditor({ routine }: { routine: RoutineSession[] }) {
  return (
    <Accordion type='single' collapsible className='w-full'>
      {routine.map((session) => (
        <AccordionItem key={session.id} value={session.id}>
          <AccordionTrigger className='text-sm'>
            <span className='flex items-center gap-2'>
              <span className='text-muted-foreground text-xs tabular-nums'>{session.ordinal}</span>
              {session.name}
              <SplitBadge split={session.splitType as SplitType} />
            </span>
          </AccordionTrigger>
          <AccordionContent>
            {session.exercises.map((exercise) => (
              <ExerciseEditor key={exercise.id} exercise={exercise} />
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
