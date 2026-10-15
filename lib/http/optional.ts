/** Optional enrichment cannot hold primary content hostage. Fail closed. */
export async function optionalWithin<T>(
  work: Promise<T>,
  fallback: T,
  milliseconds = 1500
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work.catch(() => fallback),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
