import type { PropsWithChildren } from 'react';

import { RefMark } from './RefMark';

interface RefProps {
  href?: string;
  title?: string;
  id?: string;
  /** Set by the remark plugin; authors never write it. */
  index?: string | number;
}

/**
 * Marks a passage as referring to something. In MDX:
 * `<Ref href="https://example.org/paper" title="The paper">this claim</Ref>`
 * The passage keeps its text and gains a numbered mark.
 */
export function Ref({
  href,
  title,
  id,
  index,
  children,
}: PropsWithChildren<RefProps>) {
  const key = id ?? href ?? title ?? '';
  return (
    <>
      {children}
      {index !== undefined && (
        <RefMark
          id={key}
          index={index}
          kind="link"
          content={title ?? String(children ?? href ?? '')}
          href={href}
        />
      )}
    </>
  );
}

export default Ref;
