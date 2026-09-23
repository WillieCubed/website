import {
  Atkinson_Hyperlegible_Mono,
  Atkinson_Hyperlegible_Next,
} from 'next/font/google';

// Shared by the root layout and the global error boundary, which renders
// its own document and would otherwise fall back to the system font.
export const sansFont = Atkinson_Hyperlegible_Next({
  variable: '--font-atkinson',
  display: 'swap',
  subsets: ['latin'],
});
export const monoFont = Atkinson_Hyperlegible_Mono({
  variable: '--font-atkinson-mono',
  display: 'swap',
  subsets: ['latin'],
});
