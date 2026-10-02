import { z } from 'zod';

import { imageAltIssue } from '@/lib/accessibility/alt-policy';
import { DateSchema } from '@/lib/initiatives/schema';

import { OWNER_KEYS } from './owners';

/**
 * Frontmatter for content/projects/<slug>.mdx. Every field a visitor reads
 * is Willie's own words; see docs/projects.md. Unknown keys fail the build
 * so a misspelled field cannot silently disappear.
 */

export const ProjectStatusSchema = z.enum([
  'planned',
  'active',
  'paused',
  'complete',
  'unreleased',
  'handed-off',
  'archived',
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const VisibilitySchema = z.enum(['public', 'facts', 'hidden']);
export type Visibility = z.infer<typeof VisibilitySchema>;

const HttpsSchema = z
  .string()
  .url()
  .regex(/^https:\/\//);
const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

export const ProjectMediaSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('image'),
      src: z.string().min(1),
      /** Willie's words, under the policy in docs/accessibility.md. */
      alt: z.string(),
      decorative: z.literal(true).optional(),
      caption: z.string().min(1).optional(),
    }),
    z.strictObject({
      kind: z.literal('video'),
      youtubeId: z.string().min(1),
      title: z.string().min(1),
    }),
    z.strictObject({
      kind: z.literal('document'),
      href: z.string().min(1),
      title: z.string().min(1),
    }),
  ])
  // The same policy the initiative schema and pnpm content:check apply.
  .superRefine((media, context) => {
    if (media.kind !== 'image') return;
    const message = imageAltIssue(media.alt, media.decorative === true);
    if (message) context.addIssue({ code: 'custom', path: ['alt'], message });
  });
export type ProjectMedia = z.infer<typeof ProjectMediaSchema>;

export const ProjectFrontmatterSchema = z.strictObject({
  title: z.string().min(1),
  line: z.string().min(1).optional(),
  owners: z.array(z.enum(OWNER_KEYS)).default([]),
  parent: SlugSchema.optional(),
  initiative: SlugSchema.optional(),
  successor: z.union([HttpsSchema, SlugSchema]).optional(),
  roles: z.array(z.string().min(1)).default([]),
  collaborators: z
    .array(
      z.strictObject({ name: z.string().min(1), href: HttpsSchema.optional() })
    )
    .default([]),
  starts: DateSchema.optional(),
  ends: DateSchema.optional(),
  updated: DateSchema.optional(),
  status: ProjectStatusSchema.optional(),
  weight: z.number().int().min(0).max(100).default(0),
  visibility: VisibilitySchema.default('public'),
  brand: z
    .string()
    .regex(/^(#[0-9a-fA-F]{6}|[a-z][a-z0-9-]*)$/)
    .optional(),
  website: HttpsSchema.optional(),
  media: z.array(ProjectMediaSchema).default([]),
  links: z
    .array(
      z.strictObject({
        href: z.string().min(1),
        label: z.string().min(1).optional(),
      })
    )
    .default([]),
  draft: z.boolean().default(false),
});
export type ProjectFrontmatter = z.infer<typeof ProjectFrontmatterSchema>;

export interface Project extends Omit<ProjectFrontmatter, 'status'> {
  /** The file name without `.mdx`, and the URL segment. */
  slug: string;
  /** Resolved from the dates when the frontmatter leaves it out. */
  status: ProjectStatus;
  /** The MDX body; always empty unless visibility is `public`. */
  content: string;
  /** Always empty unless visibility is `public`; the loader drops it. */
  media: ProjectMedia[];
  /** Site-relative path of the project page. */
  href: string;
}
