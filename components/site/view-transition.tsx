import * as React from 'react';
import type { ReactNode } from 'react';

// Next.js ships React's canary build, which has ViewTransition. Plain Node,
// where the unit tests render components, resolves the stable build, which
// does not, and a named import of a missing export stops the module loading.
function Passthrough({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export const ViewTransition: typeof React.ViewTransition =
  React.ViewTransition ?? (Passthrough as typeof React.ViewTransition);
