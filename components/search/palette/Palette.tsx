'use client';

import React from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import { usePaletteSession } from '@/components/search/palette/usePaletteSession';
import { useBackdropDismiss } from '@/components/site/useBackdropDismiss';

import { type ExcerptPart } from '@/lib/search/palette/search';
import type {
  CloseOptions,
  Command,
  PaletteData,
  Readout,
} from '@/lib/search/palette/types';

import './palette.css';

interface ReadoutViewProps {
  readout: Readout;
}

function ReadoutView({ readout }: ReadoutViewProps) {
  return (
    <section
      className="palette-readout scroller min-h-0 overflow-y-auto overscroll-contain rounded-2xl bg-card p-5 font-mono text-[14px]/[22px] [overflow-wrap:anywhere]"
      aria-label="Command output"
      tabIndex={0}
      data-failed={readout.failed ? '' : undefined}
    >
      <p className="palette-readout__heading m-0 text-base leading-6 font-bold">
        {readout.heading}
      </p>
      {readout.fields && readout.fields.length > 0 && (
        <dl className="palette-readout__fields mt-4 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-related max-[599px]:grid-cols-[minmax(0,1fr)] max-[599px]:gap-0">
          {readout.fields.map(([label, value], index) => (
            // Headers can repeat, so the position keeps keys unique.
            <div key={`${label}-${index}`} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd className="m-0">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {readout.body && (
        <pre className="palette-readout__body mt-4 [font:inherit] whitespace-pre-wrap">
          {readout.body}
        </pre>
      )}
    </section>
  );
}

interface ExcerptProps {
  parts: ExcerptPart[];
}

function Excerpt({ parts }: ExcerptProps) {
  return (
    <span className="palette-option__detail palette-option__excerpt overflow-hidden text-ellipsis whitespace-normal text-sm leading-5 text-muted">
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

interface PendingReadoutProps {
  readout: Readout | null;
  pending: string | null;
}

function PendingReadout({ readout, pending }: PendingReadoutProps) {
  if (!readout && !pending) return null;
  return (
    <ReadoutView
      readout={readout ?? { heading: `${pending}`, body: 'Asking the server…' }}
    />
  );
}

function searchStatusAvailable(
  readout: Readout | null,
  pending: string | null,
  typed: string,
  egg: Command | undefined
): boolean {
  return !readout && !pending && typed.length >= 2 && !egg;
}

function searchStatusMessage(
  query: string,
  error: string | null,
  searching: boolean,
  count: number
): string {
  if (searching) return 'Searching…';
  if (error) return error;
  return count > 0
    ? `${count} results available.`
    : `Nothing on the site matches “${query.trim()}”.`;
}
interface SearchStatusProps {
  query: string;
  error: string | null;
  searching: boolean;
  count: number;
  onClose: (options?: CloseOptions) => void;
}
function PaletteSearchStatus({
  query,
  error,
  searching,
  count,
  onClose,
}: SearchStatusProps) {
  return (
    <div className="palette-search-status">
      <p className="palette-empty m-0 px-5 pt-5 pb-3 text-muted" role="status">
        {searchStatusMessage(query, error, searching, count)}
      </p>
      {error && (
        <SiteLink
          preview={false}
          href={`/search?q=${encodeURIComponent(query.trim())}`}
          onClick={() => onClose({ animate: false, restoreFocus: false })}
        >
          Search without instant search
        </SiteLink>
      )}
    </div>
  );
}

interface PaletteBodyProps {
  data: PaletteData;
  contextCommands: Command[];
  open: boolean;
  onClose: (options?: CloseOptions) => void;
}
/**
 * The palette's contents: the combobox, the result groups, and an egg's
 * readout. Remounted for each opening, so every session starts empty.
 */
function PaletteBody({
  data,
  contextCommands,
  open,
  onClose,
}: PaletteBodyProps) {
  const {
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
  } = usePaletteSession({ data, contextCommands, open, onClose });
  const showList = rows.length > 0;
  let optionIndex = -1;

  return (
    <>
      <div className="palette-field flex min-h-14 flex-none items-center gap-stack rounded-2xl bg-surface-container-highest px-5 py-0">
        <Icon name="search" size={20} className="flex-none text-muted" />
        <input
          ref={inputRef}
          className="min-w-0 flex-1 border-0 bg-transparent px-0 py-4 font-sans text-[18px]/[28px] text-ink outline-none placeholder:text-muted placeholder:opacity-100"
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

      <div className="palette-body flex h-[min(320px,45dvh)] min-h-0 flex-1 flex-col gap-3">
        <PendingReadout readout={readout} pending={pending} />
        {showList && (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Results"
            className="palette-list scroller flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain"
          >
            {sections.map((section) => (
              <div
                key={section.label}
                role="group"
                aria-labelledby={`${id}-${section.label}`}
                className="palette-group rounded-2xl bg-card px-2 pt-2 pb-2"
              >
                <div
                  id={`${id}-${section.label}`}
                  className="palette-group__label px-3 pt-3 pb-2 text-xs leading-4 font-semibold tracking-[.05em] text-muted"
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
                      className="palette-option grid grid-cols-[20px_minmax(0,1fr)] items-center gap-x-4 rounded-xl p-3 cursor-pointer transition-[background-color,color] duration-[160ms] ease-site aria-selected:bg-secondary-container aria-selected:text-on-secondary-container"
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
                        className="palette-option__icon text-muted"
                      />
                      <span className="palette-option__title overflow-hidden text-ellipsis whitespace-nowrap font-semibold">
                        {row.title}
                      </span>
                      {row.excerpt ? (
                        <Excerpt parts={row.excerpt} />
                      ) : (
                        row.detail && (
                          <span className="palette-option__detail overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-5 text-muted">
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
        {searchStatusAvailable(readout, pending, typed, egg) && (
          <PaletteSearchStatus
            query={query}
            error={searchError}
            searching={searching}
            count={rows.length}
            onClose={onClose}
          />
        )}
      </div>

      <p
        className="palette-hints m-0 flex flex-none gap-5 px-3 pt-1 pb-1 text-xs leading-4 text-muted"
        aria-hidden="true"
      >
        <span>
          <kbd className="mr-1 font-mono text-xs leading-4 font-semibold text-ink">
            ↑
          </kbd>
          <kbd className="mr-1 font-mono text-xs leading-4 font-semibold text-ink">
            ↓
          </kbd>{' '}
          move
        </span>
        <span>
          <kbd className="mr-1 font-mono text-xs leading-4 font-semibold text-ink">
            Enter
          </kbd>{' '}
          open
        </span>
        <span>
          <kbd className="mr-1 font-mono text-xs leading-4 font-semibold text-ink">
            Esc
          </kbd>{' '}
          close
        </span>
      </p>

      {/* Egg readouts and copy confirmations are read out as they land. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}
interface PaletteProps {
  ref: React.Ref<HTMLDialogElement>;
  data: PaletteData;
  contextCommands: Command[];
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
  contextCommands,
  open,
  session,
  onClose,
  onForcedClose,
}: PaletteProps) {
  const backdrop = useBackdropDismiss(onClose);
  return (
    <dialog
      ref={ref}
      className="palette box-border mx-auto mt-[12vh] w-[min(640px,calc(100vw_-_32px))] max-w-none max-h-[min(680px,calc(100dvh_-_20vh))] overflow-hidden rounded-[28px] border-0 bg-surface-container p-3 font-sans text-base leading-6 text-ink shadow-[0_4px_16px_-4px_color-mix(in_srgb,var(--color-scrim)_28%,transparent)] [&[open]]:flex [&[open]]:flex-col [&[open]]:gap-3 max-[599px]:w-[calc(100vw_-_16px)] max-[599px]:max-h-[calc(100dvh_-_16px)] max-[599px]:mt-2 max-[599px]:rounded-3xl max-[599px]:p-2 max-[599px]:[&[open]]:gap-2"
      aria-label="Command palette"
      onCancel={(event) => {
        // Escape closes through the provider, so the card morphs back.
        event.preventDefault();
        onClose();
      }}
      onClose={onForcedClose}
      {...backdrop}
    >
      {/* Mounted from the first opening on, so the card keeps its contents
          while it morphs or fades away on close. */}
      {session > 0 && (
        <PaletteBody
          key={session}
          data={data}
          contextCommands={contextCommands}
          open={open}
          onClose={onClose}
        />
      )}
    </dialog>
  );
}
