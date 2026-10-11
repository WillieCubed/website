import Image from 'next/image';

/** Official small-cut asset, with at least 25% cube-height clear space. */
export default function StudioMark() {
  return (
    <span className="studio-mark">
      <Image
        src="/brand/mark/williecubed-mark-small.svg"
        alt=""
        aria-hidden="true"
        width={28}
        height={28}
      />
    </span>
  );
}
