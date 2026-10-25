import sanitizeHtml from 'sanitize-html';

/** Private prose uses the same HTML boundary in reading and preview views. */
export const studioHtmlPolicy = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img',
    'figure',
    'figcaption',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['id'],
  },
  allowedSchemes: ['https', 'http', 'mailto'],
};
