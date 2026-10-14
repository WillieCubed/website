import Image from 'next/image';

import { Downloads } from '@/components/brand/Downloads.tsx';

import { kit } from '@/lib/brand/kit';

const INTRO =
  'Here’s the cube, the colors, and the type I use across my projects.';
export default function BrandIntro() {
  return (
    <section className="brand-intro" aria-labelledby="brand-title">
      <Image
        src="/brand/mark/williecubed-mark.svg"
        alt=""
        aria-hidden="true"
        width={96}
        height={96}
        loading="eager"
      />
      <div>
        <h1 id="brand-title" className="text-display-small text-ink">
          WillieCubed brand
        </h1>
        <p>{INTRO}</p>
        <Downloads files={[kit.archive]} showSize />
      </div>
    </section>
  );
}
