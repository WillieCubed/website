'use client';

import React from 'react';

import Icon from '@/components/icons/Icon';
import { usePaletteSession } from '@/components/search/palette/usePaletteSession';
import { useBackdropDismiss } from '@/components/site/useBackdropDismiss';

import { type ExcerptPart } from '@/lib/search/palette/search';
import type {
  CloseOptions,
  PaletteData,
  Readout,
} from '@/lib/search/palette/types';

import './palette.css';

function ReadoutView({ readout }: { readout: Readout }) {
  return (
    <section
      className="palette-readout scroller"
      aria-label="Command output"
      tabIndex={0}
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
  const {
    id,
    listboxId,
    inputRef,
    query,
    searchError,
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
  } = usePaletteSession({ data, open, onClose });
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
            className="palette-list scroller"
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
  const backdrop = useBackdropDismiss(onClose);
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
      {...backdrop}
    >
      {/* Mounted from the first opening on, so the card keeps its contents
          while it morphs or fades away on close. */}
      {session > 0 && (
        <PaletteBody key={session} data={data} open={open} onClose={onClose} />
      )}
    </dialog>
  );
}
