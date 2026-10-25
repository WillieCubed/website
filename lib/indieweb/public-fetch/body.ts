/**
 * Read a body as bytes, stopping once it passes `limit` bytes. Resolves null
 * for a body that is too large, without reading the rest of it.
 */
export async function readCappedBytes(
  body: ReadableStream<Uint8Array> | null,
  limit: number
): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function readCappedText(
  body: ReadableStream<Uint8Array> | null,
  limit: number
): Promise<string | null> {
  const bytes = await readCappedBytes(body, limit);
  return bytes === null ? null : new TextDecoder().decode(bytes);
}

/** A document reached on the public internet, after any redirects. */
export interface PublicDocument {
  /** The address the document came from, after redirects. */
  url: string;
  status: number;
  contentType: string;
  headers: Headers;
  /** The body, or '' for a status outside 200–299, which is not read. */
  body: string;
}

/** Read an accepted document body within its byte and MIME-type limits. */
export async function readPublicDocument(
  response: Response,
  current: URL,
  {
    method,
    bodyContentTypes,
    maxBytes,
  }: { method: string; bodyContentTypes?: readonly string[]; maxBytes: number }
): Promise<PublicDocument | null> {
  const document = {
    url: current.href,
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    headers: response.headers,
  };
  if (method === 'HEAD' || !response.ok) {
    await discardResponseBody(response);
    return { ...document, body: '' };
  }
  const mimeType = document.contentType.split(';')[0].trim().toLowerCase();
  if (bodyContentTypes && mimeType && !bodyContentTypes.includes(mimeType)) {
    await discardResponseBody(response);
    return { ...document, body: '' };
  }
  const length = Number(response.headers.get('content-length'));
  if (length > maxBytes) {
    await discardResponseBody(response);
    return null;
  }
  const body = await readCappedText(response.body, maxBytes);
  return body === null ? null : { ...document, body };
}

export async function discardResponseBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => {});
}
