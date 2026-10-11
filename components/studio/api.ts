export async function studioRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`/api/studio${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        result.error?.message ||
          result.error ||
          'The request could not be completed.'
      ),
      { status: response.status }
    );
  return result as T;
}
