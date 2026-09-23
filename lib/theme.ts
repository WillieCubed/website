/**
 * Theme colors needed outside the app stylesheet. Components must use the CSS
 * role tokens instead; these values are for metadata, generated images, and
 * standalone route-handler documents that cannot load app/globals.css.
 */
export const themeSchemes = {
  light: {
    primary: '#2f6f5e',
    surface: '#f4f5ef',
    surfaceContainerLowest: '#fbfcf9',
    onSurface: '#1c231e',
    onSurfaceVariant: '#5c665e',
    outlineVariant: '#dfe3da',
  },
  dark: {
    primary: '#93d3bf',
    surface: '#111413',
    surfaceContainerLowest: '#0b0f0e',
    onSurface: '#e1e3e0',
    onSurfaceVariant: '#bfc9c4',
    outlineVariant: '#3f4945',
  },
} as const;
