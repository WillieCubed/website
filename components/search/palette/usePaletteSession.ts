'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  buildCommands,
  findEgg,
  matchCommands,
  normalizeQuery,
} from '@/lib/search/palette/commands';
import { EGG_HINTS } from '@/lib/search/palette/commands';
import type {
  CloseOptions,
  Command,
  PaletteData,
  Readout,
} from '@/lib/search/palette/types';

import './palette.css';
import { type Row, sectionsFor } from './rows';
import { usePaletteSearch } from './usePaletteSearch';

interface Props {
  data: PaletteData;
  contextCommands: Command[];
  open: boolean;
  onClose: (options?: CloseOptions) => void;
}
export function usePaletteSession({
  data,
  contextCommands,
  open,
  onClose,
}: Props) {
  const router = useRouter();
  const id = useId();
  const listboxId = `${id}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const search = usePaletteSearch(normalizeQuery(query));
  // The readout belongs to the input that produced it and goes when it
  // changes; `pending` holds the command still waiting on its request.
  const [readout, setReadout] = useState<Readout | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [active, setActive] = useState(0);
  const placeholder = usePlaceholder(open && query === '');

  const commands = useMemo(
    () => [...contextCommands, ...buildCommands(data)],
    [contextCommands, data]
  );
  const typed = normalizeQuery(query);
  const egg = findEgg(commands, query);
  // The theme commands read the page's scheme, so the list is worked out
  // on every render rather than memoised against the query alone.
  const matched = matchCommands(commands, query);
  const { searching, rows: results, error: searchError } = search;
  const sections = readout || pending ? [] : sectionsFor(matched, results);
  const rows = sections.flatMap((section) => section.rows);
  const activeRow = active >= 0 ? rows[active] : undefined;

  // Keeps the active row in view as the arrow keys move it.
  useEffect(() => {
    if (!activeRow) return;
    document
      .getElementById(`${id}-option-${active}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [id, active, activeRow?.key]);

  function changeQuery(value: string) {
    setQuery(value);
    setReadout(null);
    setAnnouncement('');
    // An exact egg name leaves no row active, so Enter runs what was typed
    // until the visitor picks a row with the arrow keys.
    setActive(findEgg(commands, value) ? -1 : 0);
  }

  function show(result: Readout) {
    setReadout(result);
    const firstLine = result.body?.split('\n').find(Boolean);
    setAnnouncement([result.heading, firstLine].filter(Boolean).join('. '));
  }

  function openHref(href: string, opens: Command['opens'] = 'router') {
    if (opens === 'tab') {
      window.open(href, '_blank', 'noopener,noreferrer');
      onClose();
      return;
    }
    // The page is about to change, so the palette steps aside at once
    // rather than morphing back into a trigger that is leaving.
    onClose({ animate: false, restoreFocus: false });
    if (opens === 'document') window.location.assign(href);
    else router.push(href);
  }

  async function run(command: Command) {
    if (command.href) {
      openHref(command.href, command.opens);
      return;
    }
    if (!command.run) return;
    setPending(command.title);
    // Once the palette closes, its input is gone from the page, and focus
    // belongs to whatever the provider hands it back to.
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      onClose();
    };
    try {
      const result = await command.run({ close });
      if (result) show(result);
      else close();
    } catch (error) {
      show({
        heading: `${command.title} failed`,
        body: error instanceof Error ? error.message : String(error),
        failed: true,
      });
    } finally {
      setPending(null);
      if (!closed) inputRef.current?.focus();
    }
  }

  function choose(row: Row | undefined) {
    if (!row) return;
    if (row.command) void run(row.command);
    else if (row.search) openHref(row.search.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (rows.length > 0) setActive((index) => (index + 1) % rows.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (rows.length > 0)
          setActive((index) => (index <= 0 ? rows.length : index) - 1);
        break;
      case 'Enter':
        event.preventDefault();
        if (pending) break;
        if (activeRow) choose(activeRow);
        else if (egg) void run(egg);
        break;
    }
  }

  return {
    id,
    listboxId,
    inputRef,
    query,
    searchError,
    searching,
    readout,
    pending,
    announcement,
    active,
    setActive,
    placeholder,
    typed,
    egg,
    sections,
    rows,
    activeRow,
    changeQuery,
    choose,
    onKeyDown,
  };
}

const PLACEHOLDER = 'Search, or jump somewhere';
/** How often the placeholder moves on, and how many turns a hint waits. */
const HINT_TICK_MS = 3500;
const HINT_EVERY = 3;
/** Cycles the placeholder through a hint now and then while it shows. */
function usePlaceholder(active: boolean): string {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), HINT_TICK_MS);
    return () => window.clearInterval(id);
  }, [active]);
  if (tick % HINT_EVERY !== HINT_EVERY - 1) return PLACEHOLDER;
  const hint = EGG_HINTS[Math.floor(tick / HINT_EVERY) % EGG_HINTS.length];
  return `try: ${hint}`;
}
