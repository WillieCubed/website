import CopyHex from '@/components/brand/CopyHex';
import { Downloads } from '@/components/brand/Downloads.tsx';

import { kit } from '@/lib/brand/kit';

export default function ColorsSection() {
  return (
    <section className="brand-chapter" aria-labelledby="color">
      <h2 id="color" tabIndex={-1}>
        Colors
      </h2>
      <p className="brand-section-note">
        I use the same palette for the cube and this site. The paper color
        becomes its top face, the text color becomes its shaded face, and mint
        fills the third. Even the almost-black and almost-white have a little
        green in them. The logo doesn’t need a separate set of colors to feel at
        home here.
      </p>
      <ul className="brand-swatches">
        {kit.colors.map((color) => (
          <li key={color.key} className="brand-swatch">
            <span
              className="brand-chip"
              style={{ backgroundColor: color.hex }}
            />
            <h3>{color.name}</h3>
            <p>{color.role}</p>
            <dl>
              <dt>Hex</dt>
              <dd>
                <CopyHex name={color.name} value={color.hex} />
              </dd>
              <dt>RGB</dt>
              <dd>
                <code>{color.rgb}</code>
              </dd>
              <dt>OKLCH</dt>
              <dd>
                <code>{color.oklch}</code>
              </dd>
            </dl>
          </li>
        ))}
      </ul>
      <Downloads files={kit.tokens} />
    </section>
  );
}
