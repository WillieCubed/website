export interface AnchorBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
interface PlacementOptions {
  align: 'start' | 'end';
  placement: 'default' | 'breadcrumb';
  preferredWidth: number;
}

function anchorEdges(anchor: AnchorBounds, breadcrumb: boolean) {
  return {
    top: anchor.top,
    bottom: anchor.bottom,
    gap: breadcrumb ? 4 : 8,
  };
}

function breadcrumbLeft(
  button: HTMLButtonElement | null,
  menu: HTMLElement,
  menuRect: DOMRect,
  anchor: AnchorBounds
): number {
  const label = button?.querySelector<HTMLElement>(
    '.site-breadcrumb-menu__label'
  );
  const link = menu.querySelector<HTMLElement>('.site-breadcrumb-menu__link');
  const inset = link
    ? link.getBoundingClientRect().left -
      menuRect.left +
      parseFloat(getComputedStyle(link).paddingLeft)
    : 0;
  return (label?.getBoundingClientRect().left ?? anchor.left) - inset;
}

function searchBottom(
  button: HTMLButtonElement | null,
  left: number,
  width: number
): number {
  const search = button
    ?.closest('header')
    ?.querySelector<HTMLElement>('.palette-trigger--compact')
    ?.getBoundingClientRect();
  return search && left < search.right && left + width > search.left
    ? search.bottom
    : 0;
}

/** Read anchor/menu geometry before applying the constrained viewport position. */
export function positionPopover(
  menu: HTMLDivElement,
  button: HTMLButtonElement | null,
  anchor: AnchorBounds,
  { align, placement, preferredWidth }: PlacementOptions
): void {
  const horizontalInset = 16;
  const verticalInset = 18;
  const breadcrumb = placement === 'breadcrumb';
  const edges = anchorEdges(anchor, breadcrumb);
  if (breadcrumb) menu.style.width = '';
  const menuRect = menu.getBoundingClientRect();
  const width = breadcrumb
    ? menuRect.width
    : Math.min(preferredWidth, innerWidth - 32);
  let preferredLeft = align === 'start' ? anchor.left : anchor.right - width;
  if (breadcrumb)
    preferredLeft = breadcrumbLeft(button, menu, menuRect, anchor);
  const left = Math.min(
    Math.max(horizontalInset, preferredLeft),
    innerWidth - width - horizontalInset
  );
  const belowTop = Math.max(
    edges.bottom + edges.gap,
    breadcrumb ? searchBottom(button, left, width) + edges.gap : 0
  );
  const belowSpace = Math.max(0, innerHeight - verticalInset - belowTop);
  const aboveSpace = Math.max(0, edges.top - verticalInset - edges.gap);
  const desiredHeight = menu.scrollHeight;
  const placeAbove = desiredHeight > belowSpace && aboveSpace > belowSpace;
  const availableHeight = placeAbove ? aboveSpace : belowSpace;
  if (!breadcrumb) menu.style.width = `${width}px`;
  // Anchor rectangles include the reserved start-side scrollbar gutter;
  // fixed positioning starts inside it.
  menu.style.left = `${left - document.documentElement.getBoundingClientRect().left}px`;
  menu.style.maxHeight = `${availableHeight}px`;
  menu.style.top = placeAbove
    ? `${edges.top - edges.gap - Math.min(desiredHeight, availableHeight)}px`
    : `${belowTop}px`;
}
