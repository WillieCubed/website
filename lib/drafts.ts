/** Draft visibility is an explicit deployment role, never inferred from NODE_ENV. */
export const showDrafts = process.env.SITE_MODE === 'preview';
