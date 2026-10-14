export interface CatalogProperty {
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  description: string;
  label?: string;
  options?: readonly { value: string; label: string }[];
}

export interface CatalogEntry {
  id: string;
  version: string;
  name: string;
  description: string;
  component: string;
  properties: Record<string, CatalogProperty>;
  example: Record<string, unknown>;
  accessibility: string;
}

const string = (description: string, required = true): CatalogProperty => ({
  type: 'string',
  description,
  required,
});

export const BUILTIN_CATALOG: CatalogEntry[] = [
  {
    id: 'figure',
    version: '1',
    name: 'Figure',
    description: 'A photograph or illustration with a caption.',
    component: 'Figure',
    properties: {
      src: string('Image URL or uploaded private asset.'),
      alt: string('Describe the information the image adds.'),
      caption: string('Visible context for the image.', false),
    },
    example: { src: '', alt: '', caption: '' },
    accessibility:
      'Describe informative images. The caption should add context rather than repeat the alt text.',
  },
  {
    id: 'callout',
    version: '1',
    name: 'Callout',
    description: 'A short aside within your writing.',
    component: 'Callout',
    properties: { title: string('A short heading.', false) },
    example: { title: 'A thought' },
    accessibility: 'Keep the aside understandable in reading order.',
  },
  {
    id: 'reference',
    version: '1',
    name: 'Reference',
    description: 'A passage linked to its source.',
    component: 'Ref',
    properties: {
      href: string('Absolute URL of the source.'),
      title: string('Name of the source.', false),
    },
    example: { href: 'https://example.com', title: 'Source' },
    accessibility: 'Use descriptive linked text in the block content.',
  },
  {
    id: 'youtube',
    version: '1',
    name: 'YouTube',
    description: 'A video with a portable link.',
    component: 'YouTube',
    properties: {
      videoId: string('The YouTube video ID.'),
      title: string('Describe the video.'),
      transcript: string(
        'Transcript or equivalent summary for the portable version.'
      ),
    },
    example: { videoId: '', title: '', transcript: '' },
    accessibility:
      'Provide captions on the video and a transcript or equivalent summary here.',
  },
  {
    id: 'spotify',
    version: '1',
    name: 'Spotify',
    description: 'Audio with a portable link.',
    component: 'Spotify',
    properties: {
      url: string('Spotify URL.'),
      transcript: string('Describe the audio; transcribe spoken content.'),
    },
    example: { url: '', transcript: '' },
    accessibility:
      'Provide an equivalent description or transcript for readers who cannot hear the audio.',
  },
  {
    id: 'soundcloud',
    version: '1',
    name: 'SoundCloud',
    description: 'Audio with a portable link.',
    component: 'SoundCloud',
    properties: {
      url: string('SoundCloud URL.'),
      transcript: string('Describe the audio; transcribe spoken content.'),
    },
    example: { url: '', transcript: '' },
    accessibility:
      'Provide an equivalent description or transcript for readers who cannot hear the audio.',
  },
];

export function catalogEntry(
  id: string,
  version: string
): CatalogEntry | undefined {
  return BUILTIN_CATALOG.find(
    (item) => item.id === id && item.version === version
  );
}
