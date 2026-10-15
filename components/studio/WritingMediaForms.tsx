'use client';

import type { Transaction } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { type RefObject, useEffect, useRef, useState } from 'react';

import Button from '@/components/site/Button';

import type { UploadedStudioAsset } from '@/lib/studio/types';

import { studioRequest } from './api';
import type { WritingRange } from './writing-contracts';

interface WritingMediaPanelProps {
  editor: Editor | null;
  top: number;
  onClose: () => void;
  onCancel: () => void;
  onHeightChange: (height: number) => void;
}

interface WritingImageFormProps extends WritingMediaPanelProps {
  visible: boolean;
  onStatus: (message: string) => void;
}
interface WritingLinkFormProps extends WritingMediaPanelProps {
  range: RefObject<WritingRange>;
}
interface EditorTransactionEvent {
  transaction: Transaction;
}

export function WritingImageForm({
  editor,
  visible,
  top,
  onClose,
  onCancel,
  onStatus,
  onHeightChange,
}: WritingImageFormProps) {
  const panel = usePanelHeight(onHeightChange);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const inFlight = useRef(false);

  async function upload() {
    if (
      file === null ||
      editor === null ||
      description.trim().length === 0 ||
      inFlight.current
    )
      return;
    inFlight.current = true;
    setUploading(true);
    let insertion = editor.state.selection.getBookmark();
    const trackInsertion = ({ transaction }: EditorTransactionEvent) => {
      insertion = insertion.map(transaction.mapping);
    };
    editor.on('transaction', trackInsertion);
    const data = new FormData();
    data.append('file', file);
    onStatus('Uploading image…');
    try {
      const asset = await studioRequest<UploadedStudioAsset>('/assets', {
        method: 'POST',
        body: data,
      });
      editor
        .chain()
        .setTextSelection(insertion.resolve(editor.state.doc).from)
        .insertContent({
          type: 'catalogBlock',
          attrs: {
            id: 'figure',
            version: '1',
            props: {
              src: asset.url,
              alt: description,
              caption: '',
              size: 'default',
            },
            instance: crypto.randomUUID(),
          },
        })
        .run();
      if (visibleRef.current) editor.commands.focus();
      onClose();
    } catch (error) {
      onStatus((error as Error).message);
    } finally {
      editor.off('transaction', trackInsertion);
      inFlight.current = false;
      setUploading(false);
    }
  }

  return (
    <form
      ref={panel}
      aria-busy={uploading}
      className="studio-task studio-task-form studio-inline-media"
      style={{ top }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        if (!uploading) onCancel();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void upload();
      }}
    >
      <h2 className="text-title-large">Add an image</h2>
      <label className="site-field">
        Image file
        <input
          type="file"
          accept="image/*"
          required
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
      </label>
      <label className="site-field">
        Image description
        <textarea
          autoFocus
          value={description}
          required
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What does this image add to the writing?"
        />
      </label>
      <Button type="submit" disabled={uploading}>
        {uploading ? 'Uploading…' : 'Insert image'}
      </Button>
      <Button type="button" disabled={uploading} onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

export function WritingLinkForm({
  editor,
  range,
  top,
  onClose,
  onCancel,
  onHeightChange,
}: WritingLinkFormProps) {
  const panel = usePanelHeight(onHeightChange);
  const [address, setAddress] = useState('');
  return (
    <form
      ref={panel}
      aria-busy={false}
      className="studio-task studio-task-form studio-inline-media"
      style={{ top }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onCancel();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!/^(https?:\/\/|\/|#|mailto:)/i.test(address)) return;
        editor
          ?.chain()
          .focus()
          .setTextSelection({ from: range.current.from, to: range.current.to })
          .setLink({ href: address })
          .run();
        onClose();
      }}
    >
      <h2 className="text-title-large">Link selected text</h2>
      <label className="site-field">
        Link address
        <input
          autoFocus
          required
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="https://"
        />
      </label>
      <Button type="submit">Add link</Button>
      <Button type="button" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

function usePanelHeight(onHeightChange: (height: number) => void) {
  const panel = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const element = panel.current;
    if (element === null) return;
    const measure = () =>
      onHeightChange(element.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => {
      observer.disconnect();
      onHeightChange(0);
    };
  }, [onHeightChange]);
  return panel;
}
