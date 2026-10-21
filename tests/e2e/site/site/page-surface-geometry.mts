import { type Page, expect } from '@playwright/test';

/** Narrowing can reflow the footer, so settle at its resulting document end. */
export async function scrollToExpandedFooter(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-footer-motion', '');
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        return (
          getComputedStyle(document.querySelector('.site-footer')!)
            .getPropertyValue('--p')
            .trim() === '1.0000' &&
          Math.abs(
            document.documentElement.scrollHeight - innerHeight - scrollY
          ) < 1
        );
      })
    )
    .toBe(true);
}

/** Reads the painted surface, including clipping, without assuming its layout box shrinks. */
export async function pageSurfaceGeometry(page: Page) {
  return page.locator('body > .grow').evaluate((surface) => {
    const viewport = document.body.getBoundingClientRect();
    const bounds = surface.getBoundingClientRect();
    const style = getComputedStyle(surface);
    function usesLayoutEdges(clipPath: string) {
      const insets = clipPath
        .match(/^inset\((.*?)(?: round |\))/)?.[1]
        .trim()
        .split(/\s+/);
      const rightInset = insets?.[1] ?? insets?.[0];
      const leftInset = insets?.[3] ?? rightInset;
      return (
        clipPath === 'none' || (rightInset === '0px' && leftInset === '0px')
      );
    }
    const layoutEdges = usesLayoutEdges(style.clipPath);
    const y = Math.max(1, Math.min(64, bounds.bottom / 2));
    const inside = (x: number) =>
      document.elementFromPoint(x, y)?.closest('body > .grow') === surface;
    let left = viewport.left;
    let right = viewport.left + viewport.width / 2;
    for (let i = 0; i < 18; i++) {
      const mid = (left + right) / 2;
      if (inside(mid)) right = mid;
      else left = mid;
    }
    // Hit testing rounds to device pixels and the far gutter is browser UI.
    // The surface's clipping is symmetric, so measure its left edge and mirror it.
    const start = layoutEdges ? bounds.left : Math.round(right - 0.5);
    const end = layoutEdges
      ? bounds.right
      : viewport.right - (start - viewport.left);
    return {
      left: start,
      right: end,
      width: end - start,
      layoutWidth: bounds.width,
      scale: style.scale,
      clip: style.clipPath,
      opacity: style.opacity,
      viewportWidth: viewport.width,
      frameWidth: document
        .querySelector('.site-footer__inner')!
        .getBoundingClientRect().width,
    };
  });
}
