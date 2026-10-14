import { Downloads } from '@/components/brand/Downloads.tsx';
import TypographyGuide from '@/components/brand/TypographyGuide';

import { kit } from '@/lib/brand/kit';

export default function TypeSection() {
  return (
    <section aria-labelledby="type">
      <h2 id="type" tabIndex={-1}>
        Typography
      </h2>
      <TypographyGuide />
      <Downloads files={kit.tokens} />
    </section>
  );
}
