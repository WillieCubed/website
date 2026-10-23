/** Keep the loaded tile bitmap in the destination snapshot while its larger source loads. */
export async function retainDetailImage(
  source: HTMLElement | null,
  target: HTMLElement | null
) {
  const image =
    source instanceof HTMLImageElement ? source : source?.querySelector('img');
  const destination =
    target instanceof HTMLImageElement ? target : target?.querySelector('img');
  if (!image?.complete || image.naturalWidth === 0 || !destination)
    return () => undefined;
  const attributes = ['src', 'srcset', 'sizes'].map(
    (name) => [name, destination.getAttribute(name)] as const
  );
  destination.removeAttribute('srcset');
  destination.src = image.currentSrc;
  await destination.decode().catch(() => undefined);
  return () => {
    for (const [name, value] of attributes) {
      if (value === null) destination.removeAttribute(name);
      else destination.setAttribute(name, value);
    }
  };
}
