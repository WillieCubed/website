import MenuOpenSharpIcon from '@mui/icons-material/MenuOpenSharp';
import clsx from 'clsx';

export type NavItem = {
  label: string;
  href: string;
};

interface NavListItemProps {
  item: NavItem;
  isOpen?: boolean;
}

function NavListItem({
  item: { label, href },
  isOpen = false,
}: NavListItemProps) {
  return (
    <li className="p-4 block transition-width ease-in-out duration-300">
      {/* TODO: Consider icons */}
      <a href={href} className={clsx(!isOpen ? 'hidden' : '')}>
        {label}
      </a>
    </li>
  );
}

interface NavigationDrawerProps {
  items: NavItem[];
  onOpen: () => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function CollapsibleNavigationDrawer({
  items,
  onOpen,
  onClose,
  isOpen,
}: NavigationDrawerProps) {
  return (
    <nav className="border-r border-outline">
      <div className="sticky top-0">
        <div className="p-lg">
          <button
            className="size-10 hover:interactive-bg-surface-container rounded-full"
            onClick={() => {
              console.log('Is open?', isOpen);
              if (isOpen) {
                onClose();
              } else {
                onOpen();
              }
            }}
          >
            <MenuOpenSharpIcon />
          </button>
        </div>
        <div>
          <ul>
            {items.map((item) => (
              <NavListItem key={item.href} item={item} isOpen={isOpen} />
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
