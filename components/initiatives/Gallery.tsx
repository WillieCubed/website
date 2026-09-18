import Image from 'next/image';

interface GalleryItem {
  src: string;
  alt: string;
}

interface GalleryProps {
  items: GalleryItem[];
  columns?: 2 | 3;
}

/** A simple responsive grid of photos for a part's one-pager. */
export default function Gallery({ items, columns = 3 }: GalleryProps) {
  if (items.length === 0) return null;
  return (
    <ul
      className={`my-8 grid list-none gap-3 p-0 ${columns === 2 ? 'medium:grid-cols-2' : 'medium:grid-cols-2 expanded:grid-cols-3'}`}
    >
      {items.map((item) => (
        <li
          key={item.src}
          className="relative aspect-[4/3] overflow-hidden rounded-xl bg-tray"
        >
          <Image
            src={item.src}
            alt={item.alt}
            fill
            sizes="(min-width: 840px) 33vw, (min-width: 600px) 50vw, 100vw"
            className="object-cover"
            unoptimized={item.src.endsWith('.svg')}
          />
        </li>
      ))}
    </ul>
  );
}
