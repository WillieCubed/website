import type { CSSProperties } from 'react';

import JsonLd from '@/components/seo/JsonLd';
import type { BreadcrumbMenuItem } from '@/components/site/BreadcrumbMenu';
import TopBar from '@/components/site/TopBar';

import { kitColor } from '@/lib/brand/kit';
import { graph, personLd, webPageLd, websiteLd } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/metadata';
import { sitePage } from '@/lib/site/navigation';

import ApplicationsSection from '../../components/brand/ApplicationsSection';
import BrandIntro from '../../components/brand/BrandIntro';
import ColorsSection from '../../components/brand/ColorsSection';
import LogoSection from '../../components/brand/LogoSection';
import TypeSection from '../../components/brand/TypeSection';
import '../../components/brand/brand.css';

const BRAND_PAGE = sitePage('/brand');
const BRAND = {
  title: BRAND_PAGE.label,
  description: BRAND_PAGE.description,
  path: BRAND_PAGE.path,
};
const BRAND_SECTIONS: BreadcrumbMenuItem[] = [
  { label: 'Logo', href: '#mark' },
  { label: 'Colors', href: '#color' },
  { label: 'Typography', href: '#type' },
  { label: 'Applications', href: '#in-use' },
];
export const metadata = pageMetadata(BRAND);
/** Asset previews keep the kit's own paper and ink in either scheme. */
const PREVIEW_SURFACES = {
  '--brand-paper': kitColor('paper'),
  '--brand-ink': kitColor('ink'),
  '--brand-green': kitColor('green'),
} as CSSProperties;
export default function BrandPage() {
  return (
    <>
      <JsonLd
        data={graph(
          webPageLd({
            name: BRAND.title,
            description: BRAND.description,
            path: BRAND.path,
          }),
          websiteLd(),
          personLd()
        )}
      />
      <div className="brand-header">
        <TopBar
          floating
          crumbs={[
            {
              label: 'Brand',
              href: '/brand',
              menuItems: BRAND_SECTIONS,
            },
          ]}
        />
      </div>
      <main
        id="main"
        className="brand-page mx-auto max-w-[1200px] px-5 pb-20"
        style={PREVIEW_SURFACES}
      >
        <BrandIntro />

        <LogoSection />

        <ColorsSection />

        <TypeSection />

        <ApplicationsSection />
      </main>
    </>
  );
}
