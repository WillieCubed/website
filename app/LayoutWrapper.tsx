'use client';

import { PropsWithChildren, useState } from 'react';

import CollapsibleNavigationDrawer, {
  NavItem,
} from '@/components/NavigationDrawer';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';

import { randomlyChooseTagline } from '@/lib/enhancements';

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/',
  },
  {
    label: 'Projects',
    href: '/projects',
  },
  {
    label: 'Writings',
    href: '/writings',
  },
  {
    label: 'About',
    href: '/about',
  },
];

export default function LayoutWrapper({ children }: PropsWithChildren) {
  const [navIsOpen, setNavIsOpen] = useState(false);
  return (
    <>
      {/* <div className="flex">
        <CollapsibleNavigationDrawer
          items={NAV_ITEMS}
          onOpen={() => setNavIsOpen(true)}
          onClose={() => setNavIsOpen(false)}
          isOpen={navIsOpen}
        /> */}
      <main className="flex-1">
        <SiteHeader />
        {children}
      </main>
      {/* </div> */}

      <SiteFooter tagline={'Not waiting for the heat death of the universe.'} />
    </>
  );
}
