'use client';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import Popover from '@/components/site/Popover';

const sections = [
  ['mark', 'Logo'],
  ['color', 'Colors'],
  ['type', 'Typography'],
  ['in-use', 'Applications'],
] as const;

export default function SectionPicker() {
  return (
    <Popover
      label="Brand sections"
      trigger={
        <>
          Brand <Icon name="chevron-down" size={16} />
        </>
      }
      triggerClassName="site-breadcrumb brand-picker-trigger"
      panelClassName="brand-picker-panel brand-section-menu"
    >
      <nav aria-label="Brand sections">
        {sections.map(([id, label]) => (
          <SiteLink
            key={id}
            href={`#${id}`}
            preview={false}
            onClick={() =>
              document.getElementById(id)?.focus({ preventScroll: true })
            }
          >
            {label}
          </SiteLink>
        ))}
      </nav>
    </Popover>
  );
}
