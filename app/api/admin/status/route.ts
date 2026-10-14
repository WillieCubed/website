import { statusAdmin } from '@/lib/status/admin-runtime';

/**
 * Return status-editor sign-in state. For an authenticated owner, also
 * return the current city, CSRF token, and city-search results for q. Return
 * 503 when owner authentication or storage is unavailable.
 */
export const GET = statusAdmin;
/**
 * Sign the owner in with a one-time code, save a selected city, or sign out
 * according to the form action. Require a same-origin form; saving and sign-
 * out also require an owner session and CSRF token.
 */
export const POST = statusAdmin;
