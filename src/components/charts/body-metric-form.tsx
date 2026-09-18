'use client';

import { useState, useTransition } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toKg, type Unit } from '@/lib/units';
import { upsertBodyMetric } from '@/server/actions/body-metrics';

export function BodyMetricForm({ unit, today }: { unit: Unit; today: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');

  function submit() {
    const weightValue = weight === '' ? null : Number(weight);
    const waistValue = waist === '' ? null : Number(waist);

    if (weightValue === null && waistValue === null) {
      toast.error('Enter at least one measurement.');
      return;
    }

    startTransition(async () => {
      const result = await upsertBodyMetric({
        date: today,
        // Stored in kg regardless of the display unit.
        weightKg: weightValue === null ? null : toKg(weightValue, unit),
        waistCm: waistValue,
      });

      if (!result.ok) {
        toast.error(result.error ?? 'Could not save.');
        return;
      }

      toast.success("Today's measurements saved.");
      setWeight('');
      setWaist('');
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button variant='outline' size='sm' className='w-full' onClick={() => setOpen(true)}>
        <Plus className='size-4' aria-hidden />
        Log today&apos;s weight
      </Button>
    );
  }

  return (
    <div className='border-border bg-surface rounded-xl border p-4'>
      <div className='grid grid-cols-2 gap-3'>
        <div>
          <Label htmlFor='bw' className='text-xs'>
            Weight ({unit})
          </Label>
          <Input
            id='bw'
            type='number'
            inputMode='decimal'
            step='0.1'
            className='mt-1 h-11'
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor='waist' className='text-xs'>
            Waist (cm)
          </Label>
          <Input
            id='waist'
            type='number'
            inputMode='decimal'
            step='0.5'
            className='mt-1 h-11'
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
          />
        </div>
      </div>

      <div className='mt-3 flex gap-2'>
        <Button size='sm' className='flex-1' onClick={submit} disabled={pending}>
          {pending ? <Loader2 className='size-4 animate-spin' aria-hidden /> : null}
          Save
        </Button>
        <Button variant='ghost' size='sm' onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
