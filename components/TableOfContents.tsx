type TOCItem = {
  title: string;
  href: string;
};

interface TableOfContentsProps {
  items: TOCItem[];
}

export default function TableOfContents({ items }: TableOfContentsProps) {
  return (
    <div className="space-y-4">
      <div className="text-title-medium">Contents</div>
      <ul className="space-y-2 *:text-label-large">
        <li className="">
          <a href="#overview">Overview</a>
        </li>
        <li className="">
          <a href="#motivation">Motivation</a>
        </li>
        <li className="">
          <a href="#features">Features</a>
        </li>
      </ul>
    </div>
  );
}
