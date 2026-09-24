'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

import Icon, { type IconName } from '@/components/icons/Icon';

import {
  EGG_HINTS,
  buildCommands,
  findEgg,
  groupCommands,
  matchCommands,
  normalizeQuery,
} from '@/lib/palette/commands';
import {
  type ExcerptPart,
  SEARCH_GROUPS,
  type SearchKind,
  type SearchRow,
  loadPagefind,
  searchSite,
} from '@/lib/palette/search';
import type {
  Command,
  CommandKind,
  PaletteData,
  Readout,
} from '@/lib/palette/types';

import type { CloseOptions } from './PaletteProvider';
import './palette.css';

const ICONS: Record<CommandKind | SearchKind, IconName> = {
  page: 'arrow-right',
  writing: 'file',
  initiative: 'calendar',
  venture: 'compass',
  copy: 'copy',
  mail: 'mail',
  feed: 'rss',
  profile: 'external',
  'theme-dark': 'moon',
  'theme-light': 'sun',
  'theme-system': 'contrast',
  egg: 'terminal',
};

const PLACEHOLDER = 'Search, or jump somewhere';

/** How often the placeholder moves on, and how many turns a hint waits. */
const HINT_TICK_MS = 3500;
const HINT_EVERY = 3;

interface Row {
  key: string;
  title: string;
  detail?: string;
  excerpt?: ExcerptPart[];
  icon: IconName;
  command?: Command;
  search?: SearchRow;
}

interface Section {
  label: string;
  rows: Row[];
}

function commandRow(command: Command): Row {
  return {
    key: command.id,
    title: command.title,
    detail: command.detail,
    icon: ICONS[command.kind],
    command,
  };
}

function searchRow(result: SearchRow): Row {
  return {
    key: result.id,
    title: result.title,
    excerpt: result.excerpt,
    icon: ICONS[result.kind],
    search: result,
  };
}

/**
 * The sections to show: the matching commands in their groups, then search
 * results by type, leaving out any result a command already offers.
 */
function sectionsFor(commands: Command[], results: SearchRow[]): Section[] {
  // A page can be offered by more than one command (the newest writing is
  // both Latest and Go to); the first group to offer it keeps it.
  const offered = new Set<string>();
  const sections: Section[] = groupCommands(commands)
    .map((entry) => ({
      label: entry.group,
      rows: entry.commands
        .filter((command) => {
          if (!command.href) return true;
          if (offered.has(command.href)) return false;
          offered.add(command.href);
          return true;
        })
        .map(commandRow),
    }))
    .filter((section) => section.rows.length > 0);
  for (const { kind, label } of SEARCH_GROUPS) {
    const rows = results
      .filter((result) => result.kind === kind && !offered.has(result.href))
      .map(searchRow);
    if (rows.length > 0) sections.push({ label, rows });
  }
  return sections;
}

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

function ReadoutView({ readout }: { readout: Readout }) {
  return (
    <section
      className="palette-readout"
      aria-label="Command output"
      data-failed={readout.failed ? '' : undefined}
    >
      <p className="palette-readout__heading">{readout.heading}</p>
      {readout.fields && readout.fields.length > 0 && (
        <dl className="palette-readout__fields">
          {readout.fields.map(([label, value], index) => (
            // Headers can repeat, so the position keeps keys unique.
            <div key={`${label}-${index}`}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {readout.body && (
        <pre className="palette-readout__body">{readout.body}</pre>
      )}
    </section>
  );
}

function Excerpt({ parts }: { parts: ExcerptPart[] }) {
  return (
    <span className="palette-option__detail palette-option__excerpt">
      {parts.map((part, index) =>
        part.mark ? (
          <mark key={index}>{part.text}</mark>
        ) : (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        )
      )}
    </span>
  );
}

interface PaletteBodyProps {
  data: PaletteData;
  open: boolean;
  onClose: (options?: CloseOptions) => void;
}

/**
 * The palette's contents: the combobox, the result groups, and an egg's
 * readout. Remounted for each opening, so every session starts empty.
 */
function PaletteBody({ data, open, onClose }: PaletteBodyProps) {
  const router = useRouter();
  const id = useId();
  const listboxId = `${id}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchRow[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  // The readout belongs to the input that produced it and goes when it
  // changes; `pending` holds the command still waiting on its request.
  const [readout, setReadout] = useState<Readout | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [active, setActive] = useState(0);
  const placeholder = usePlaceholder(open && query === '');

  const commands = useMemo(() => buildCommands(data), [data]);
  const typed = normalizeQuery(query);
  const egg = findEgg(commands, query);
  // The theme commands read the page's scheme, so the list is worked out
  // on every render rather than memoised against the query alone.
  const matched = matchCommands(commands, query);
  const sections = readout || pending ? [] : sectionsFor(matched, results);
  const rows = sections.flatMap((section) => section.rows);
  const activeRow = active >= 0 ? rows[active] : undefined;

  // The script and its index start loading as the palette first opens, so
  // the first query does not wait on them.
  useEffect(() => {
    void loadPagefind().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typed.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }
    let current = true;
    searchSite(typed).then(
      (found) => {
        if (!current || found === null) return;
        setResults(found);
        setSearchError(null);
      },
      (error: unknown) => {
        if (!current) return;
        setResults([]);
        setSearchError(
          `Search could not load /pagefind/pagefind.js (${
            error instanceof Error ? error.message : String(error)
          }).`
        );
      }
    );
    return () => {
      current = false;
    };
  }, [typed]);

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

  const showList = rows.length > 0;
  let optionIndex = -1;

  return (
    <>
      <div className="palette-field">
        <Icon name="search" size={20} className="palette-field__icon" />
        <input
          ref={inputRef}
          className="palette-field__input"
          type="text"
          role="combobox"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-label="Search the site or type a command"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={showList ? listboxId : undefined}
          aria-activedescendant={
            showList && activeRow ? `${id}-option-${active}` : undefined
          }
          placeholder={placeholder}
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>

      <div className="palette-body">
        {(readout || pending) && (
          <ReadoutView
            readout={
              readout ?? { heading: `${pending}`, body: 'Asking the server…' }
            }
          />
        )}
        {showList && (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Results"
            className="palette-list"
          >
            {sections.map((section) => (
              <div
                key={section.label}
                role="group"
                aria-labelledby={`${id}-${section.label}`}
                className="palette-group"
              >
                <div
                  id={`${id}-${section.label}`}
                  className="palette-group__label"
                >
                  {section.label}
                </div>
                {section.rows.map((row) => {
                  optionIndex += 1;
                  const index = optionIndex;
                  return (
                    <div
                      key={row.key}
                      id={`${id}-option-${index}`}
                      role="option"
                      aria-selected={index === active}
                      className="palette-option"
                      onPointerMove={() => {
                        if (index !== active) setActive(index);
                      }}
                      onPointerDown={(event) => {
                        // Keeps focus in the input, where the keys work.
                        event.preventDefault();
                      }}
                      onClick={() => choose(row)}
                    >
                      <Icon
                        name={row.icon}
                        size={20}
                        className="palette-option__icon"
                      />
                      <span className="palette-option__title">{row.title}</span>
                      {row.excerpt ? (
                        <Excerpt parts={row.excerpt} />
                      ) : (
                        row.detail && (
                          <span className="palette-option__detail">
                            {row.detail}
                          </span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {/* Search runs from two characters on, so a single one has not
            been looked for yet and says nothing. */}
        {!showList && !readout && !pending && typed.length >= 2 && !egg && (
          <p className="palette-empty">
            {searchError ?? `Nothing on the site matches “${query.trim()}”.`}
          </p>
        )}
        {showList && searchError && (
          <p className="palette-empty">{searchError}</p>
        )}
      </div>

      <p className="palette-hints" aria-hidden="true">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> move
        </span>
        <span>
          <kbd>Enter</kbd> open
        </span>
        <span>
          <kbd>Esc</kbd> close
        </span>
      </p>

      {/* Egg readouts and copy confirmations are read out as they land. */}
      <p className="palette-live" role="status" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}

interface PaletteProps {
  ref: React.Ref<HTMLDialogElement>;
  data: PaletteData;
  open: boolean;
  /** Changes on each opening, which resets the contents. */
  session: number;
  onClose: (options?: CloseOptions) => void;
  /** The browser closed the dialog itself, without a cancel to intercept. */
  onForcedClose: () => void;
}

/**
 * The command palette: a modal dialog in the top layer. Its card is the
 * element the opening trigger morphs into (PaletteProvider).
 */
export default function Palette({
  ref,
  data,
  open,
  session,
  onClose,
  onForcedClose,
}: PaletteProps) {
  return (
    <dialog
      ref={ref}
      className="palette"
      aria-label="Command palette"
      onCancel={(event) => {
        // Escape closes through the provider, so the card morphs back.
        event.preventDefault();
        onClose();
      }}
      onClose={onForcedClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself, outside its box.
        const box = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom;
        if (event.target === event.currentTarget && outside) onClose();
      }}
    >
      {/* Mounted from the first opening on, so the card keeps its contents
          while it morphs or fades away on close. */}
      {session > 0 && (
        <PaletteBody key={session} data={data} open={open} onClose={onClose} />
      )}
    </dialog>
  );
}
