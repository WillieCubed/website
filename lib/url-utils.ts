import { absoluteRoute } from '@/lib/site';

/**
 * Tagged template that builds an absolute URL on the canonical origin.
 *
 * @example siteRoute`/projects/${project.codename}`
 */
export const siteRoute = absoluteRoute;
