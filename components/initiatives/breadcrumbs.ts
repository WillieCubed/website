import type { BreadcrumbMenuItem } from '@/components/site/BreadcrumbMenu';

import {
  type Initiative,
  getChildInitiatives,
  getInitiative,
  getInitiatives,
} from '@/lib/initiatives';

interface InitiativeCrumb {
  label: string;
  href: string;
  menuItems?: BreadcrumbMenuItem[];
}

/** Ancestors shared by the initiative's overview, parts, and structured data. */
export async function initiativeBreadcrumbs(
  initiative: Initiative
): Promise<InitiativeCrumb[]> {
  const parent = initiative.parent
    ? await getInitiative(initiative.parent).catch(() => null)
    : null;
  const parentChildren = parent ? await getChildInitiatives(parent.slug) : [];
  const topLevel = (await getInitiatives())
    .filter((item) => !item.parent)
    .slice(0, 8);
  const crumbs: InitiativeCrumb[] = [
    {
      label: 'Initiatives',
      href: '/initiatives',
      menuItems: topLevel.map((item) => ({
        label: item.title,
        href: item.href,
      })),
    },
  ];
  if (parent) {
    const crumb: InitiativeCrumb = { label: parent.title, href: parent.href };
    if (parentChildren.length > 0)
      crumb.menuItems = parentChildren.map((child) => ({
        label: child.title,
        href: child.href,
      }));
    crumbs.push(crumb);
  }
  return crumbs;
}
