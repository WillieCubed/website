import { AnchorHTMLAttributes, PropsWithChildren } from 'react';

import BrewLink from '@/components/link/BrewLink';
import SiteLink from '@/components/link/SiteLink';
import { Ref } from '@/components/references/Ref';
import { RefMark } from '@/components/references/RefMark';

import { isInternalHref } from '@/lib/site';

import Callout from './Callout';
import ImageWithCaption from './ImageWithCaption';
import SoundCloudEmbed from './SoundCloudEmbed';
import SpotifyEmbed from './SpotifyEmbed';
import YouTubeEmbed from './YouTubeEmbed';

export {
  YouTubeEmbed,
  SpotifyEmbed,
  SoundCloudEmbed,
  Callout,
  ImageWithCaption,
};

export const mdxComponents = {
  h1: ({ children }: PropsWithChildren) => (
    <h1 className="mb-4 mt-8 text-3xl font-bold text-on-surface">{children}</h1>
  ),
  h2: ({ children }: PropsWithChildren) => (
    <h2 className="mb-3 mt-8 text-2xl font-bold text-on-surface">{children}</h2>
  ),
  h3: ({ children }: PropsWithChildren) => (
    <h3 className="mb-2 mt-6 text-xl font-bold text-on-surface">{children}</h3>
  ),
  h4: ({ children }: PropsWithChildren) => (
    <h4 className="mb-2 mt-4 text-lg font-semibold text-on-surface">
      {children}
    </h4>
  ),
  p: ({ children }: PropsWithChildren) => (
    <p className="my-4 text-body-medium leading-relaxed text-on-surface">
      {children}
    </p>
  ),
  a: ({
    children,
    href = '',
    ...props
  }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) => {
    const isHeaderLink = href.startsWith('#');
    const isExternal = /^[a-z]+:/i.test(href) && !isInternalHref(href);
    return (
      <SiteLink
        href={href}
        className={
          isHeaderLink
            ? 'link-animated text-inherit after:h-[2px]'
            : 'link-animated'
        }
        {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
        {...props}
      >
        {children}
      </SiteLink>
    );
  },
  ul: ({ children }: PropsWithChildren) => (
    <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>
  ),
  ol: ({ children }: PropsWithChildren) => (
    <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>
  ),
  li: ({ children }: PropsWithChildren) => (
    <li className="text-body-medium text-on-surface">{children}</li>
  ),
  blockquote: ({ children }: PropsWithChildren) => (
    <blockquote className="my-6 -ml-[var(--bleed)] border-l-4 border-accent/40 pl-[calc(var(--bleed)-4px)] italic text-prose">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-t-2 border-outline-variant" />,
  strong: ({ children }: PropsWithChildren) => (
    <strong className="font-bold text-on-surface">{children}</strong>
  ),
  em: ({ children }: PropsWithChildren) => (
    <em className="italic">{children}</em>
  ),
  code: ({ children }: PropsWithChildren) => (
    <code className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-sm">
      {children}
    </code>
  ),
  table: ({ children }: PropsWithChildren) => (
    <div className="my-6 overflow-x-auto">
      <table className="min-w-full divide-y divide-outline-variant">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: PropsWithChildren) => (
    <th className="bg-surface-container px-4 py-3 text-left text-sm font-semibold text-on-surface">
      {children}
    </th>
  ),
  td: ({ children }: PropsWithChildren) => (
    <td className="px-4 py-3 text-sm text-on-surface-variant">{children}</td>
  ),
  // Custom components for MDX
  YouTube: YouTubeEmbed,
  YouTubeEmbed,
  Spotify: SpotifyEmbed,
  SpotifyEmbed,
  SoundCloud: SoundCloudEmbed,
  SoundCloudEmbed,
  Callout,
  Figure: ImageWithCaption,
  ImageWithCaption,
  // Reference marks: RefMark comes from the remark plugin, Ref from authors.
  RefMark,
  FootnoteRef: RefMark,
  Ref,
  // "coffee" and "tea" in prose, from remarkBrews.
  BrewLink,
};
