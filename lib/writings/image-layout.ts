const IMAGE_LAYOUTS = [
  { value: 'default', label: 'Text width' },
  { value: 'wide', label: 'Wide' },
  { value: 'full', label: 'Full bleed' },
] as const;

export type ImageLayout = (typeof IMAGE_LAYOUTS)[number]['value'];

export function imageLayout(value: unknown): ImageLayout {
  return (
    IMAGE_LAYOUTS.find((layout) => layout.value === value)?.value ?? 'default'
  );
}
