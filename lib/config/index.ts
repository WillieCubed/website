import { get } from '@vercel/edge-config';

export const REMOTE_CONFIG_KEYS: Record<string, string> = {
  showWritings: 'show_writings',
  featuredProjects: 'featured_projects',
  featuredWritings: 'featured_writings',
};

const VERCEL_REMOTE_CONFIG_VALUES: Record<
  keyof typeof REMOTE_CONFIG_KEYS,
  string | number | boolean | string[] // Default value
> = {
  showWritings: false,
  featuredProjects: [],
  featuredWritings: [],
};

export async function fetchConfig<
  KeyType extends keyof typeof REMOTE_CONFIG_KEYS,
  ValueType extends Readonly<(typeof VERCEL_REMOTE_CONFIG_VALUES)[KeyType]>,
>(key: KeyType): Promise<Readonly<ValueType>> {
  return ((await get(key)) || VERCEL_REMOTE_CONFIG_VALUES[key]) as ValueType;
}
