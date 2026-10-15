import localFont from 'next/font/local';

// Shared by the root layout and the global error boundary, which renders
// its own document and would otherwise fall back to the system font.
export const sansFont = localFont({
  src: '../../public/fonts/AtkinsonHyperlegibleNext-Latin-Variable.woff2',
  weight: '200 800',
  variable: '--font-atkinson',
  display: 'swap',
});
export const monoFont = localFont({
  src: '../../public/fonts/AtkinsonHyperlegibleMono-Latin-Variable.woff2',
  weight: '200 800',
  variable: '--font-atkinson-mono',
  display: 'swap',
});
