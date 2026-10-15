'use client';
import { type FormEvent, useState } from 'react';

/** Series creation clears the form after saving and before changing collections. */
export function useMusicSeriesCreation(
  create: (title: string) => string,
  choose: (id: string) => void
) {
  const [title, setTitle] = useState<string | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    const name = title?.trim();
    if (!name) return;
    const id = create(name);
    setTitle(null);
    choose(id);
  }
  return { title, setTitle, submit };
}
