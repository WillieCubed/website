let runtime: Promise<typeof import('./eggs')> | undefined;

/** Warm command readouts on trigger intent without delaying the dialog. */
export function preloadCommandRuntime() {
  runtime ??= import('./eggs').catch((error: unknown) => {
    runtime = undefined;
    throw error;
  });
  return runtime;
}
