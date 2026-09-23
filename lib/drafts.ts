/** Drafts render in development so they can be previewed, never in production. */
export const showDrafts = process.env.NODE_ENV !== 'production';
