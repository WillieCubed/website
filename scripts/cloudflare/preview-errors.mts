import type { Page } from '@playwright/test';

export interface BrowserError {
  source: 'console' | 'pageerror';
  message: string;
  stack?: string;
  digest?: string;
}

export function observeBrowserErrors(page: Page) {
  const errors: BrowserError[] = [];
  const pending: Promise<void>[] = [];
  page.on('pageerror', (error) => {
    errors.push({
      source: 'pageerror',
      message: error.message,
      stack: error.stack,
    });
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    errors.push({ source: 'console', message: message.text() });
    for (const argument of message.args()) {
      pending.push(
        argument
          .evaluate((value) => {
            if (!(value instanceof Error)) return null;
            return {
              message: value.message,
              stack: value.stack,
              digest: 'digest' in value ? String(value.digest) : undefined,
            };
          })
          .then((error) => {
            if (error) errors.push({ source: 'console', ...error });
          })
          .catch(() => undefined)
      );
    }
  });
  return async () => {
    await Promise.race([
      Promise.all(pending),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);
    return [...errors];
  };
}
