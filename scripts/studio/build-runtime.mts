import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('.studio', { recursive: true });
await build({
  stdin: {
    contents: `import React from 'react';
      import * as ReactDOM from 'react-dom';
      import * as ReactDOMClient from 'react-dom/client';
      import * as JSXRuntime from 'react/jsx-runtime';
      Object.assign(globalThis, {__studioReact: React, __studioReactDOM: ReactDOM,
        __studioReactDOMClient: ReactDOMClient, __studioJSXRuntime: JSXRuntime});`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: '.studio/browser-runtime.js',
});
