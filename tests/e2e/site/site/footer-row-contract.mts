import { type Page, expect } from '@playwright/test';

/** Checks rendered geometry as well as the explicit no-wrap contract. */
export async function expectSingleFooterRow(page: Page, label: string) {
  const layout = await page.locator('.site-footer__row').evaluate((row) => {
    const box = row.getBoundingClientRect();
    const groups = [...row.children].map((child) => ({
      rect: child.getBoundingClientRect().toJSON(),
      wrap: getComputedStyle(child).flexWrap,
    }));
    const targets = [...row.querySelectorAll('a, button')]
      .map((target) => ({
        rect: target.getBoundingClientRect(),
        label: target.getAttribute('aria-label') ?? target.textContent,
        translate: getComputedStyle(target).translate,
      }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0);
    const city = row.querySelector<HTMLElement>('.status-city');
    const range = document.createRange();
    if (city) range.selectNodeContents(city);
    const lines = [...range.getClientRects()].filter((rect) => rect.width > 0);
    const textLines = [
      ...row.querySelectorAll(
        '.status-city, .microstatus time, .temperature, .site-footer__label'
      ),
    ]
      .filter((el) => el.getBoundingClientRect().width > 1)
      .map((el) => {
        const text = document.createRange();
        text.selectNodeContents(el);
        const rects = [...text.getClientRects()].filter(
          (rect) => rect.width > 0
        );
        return {
          label: el.textContent,
          // Mixed font sizes (such as the temperature unit) share a line
          // when their vertical ranges overlap; their top edges can differ.
          oneLine:
            rects.length === 0 ||
            Math.max(...rects.map((rect) => rect.top)) <
              Math.min(...rects.map((rect) => rect.bottom)),
        };
      });
    return {
      wrap: getComputedStyle(row).flexWrap,
      groups,
      height: box.height,
      targetCenters: targets.map(({ rect }) => rect.y + rect.height / 2),
      targets: targets.map(({ rect, label, translate }) => ({
        label,
        center: rect.y + rect.height / 2,
        translate,
      })),
      groupCenters: groups.map(({ rect }) => rect.y + rect.height / 2),
      cityLines: new Set(lines.map((rect) => Math.round(rect.y))).size,
      textLines,
      cityClipped: Boolean(city && city.scrollWidth > city.clientWidth),
      outsideViewport: box.left < -1 || box.right > innerWidth + 1,
      bounds: { left: box.left, right: box.right, viewport: innerWidth },
    };
  });
  expect(layout.wrap, `${label}: row must never wrap`).toBe('nowrap');
  for (const group of layout.groups) {
    expect(group.wrap, `${label}: group must never wrap`).toBe('nowrap');
  }
  expect(
    Math.max(...layout.groupCenters) - Math.min(...layout.groupCenters),
    `${label}: groups must occupy the same physical line`
  ).toBeLessThanOrEqual(1);
  expect(
    Math.max(...layout.targetCenters) - Math.min(...layout.targetCenters),
    `${label}: controls must occupy the same physical line ${JSON.stringify(layout.targets)}`
  ).toBeLessThanOrEqual(1);
  expect(
    layout.height,
    `${label}: no second line may increase the row height`
  ).toBeCloseTo(Math.max(...layout.groups.map(({ rect }) => rect.height)), 0);
  expect(
    layout.cityLines,
    `${label}: city text must not wrap`
  ).toBeLessThanOrEqual(1);
  expect(layout.cityClipped, `${label}: city text must not be ellipsized`).toBe(
    false
  );
  for (const text of layout.textLines) {
    expect(text.oneLine, `${label}: ${text.label} must not wrap`).toBe(true);
  }
  expect(
    layout.outsideViewport,
    `${label}: any scrolling stays inside the row ${JSON.stringify(layout.bounds)}`
  ).toBe(false);
}
