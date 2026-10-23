import type { ReactNode } from 'react';

import './styles/rail.css';

interface Props {
  editing: boolean;
  publicEmpty: boolean;
  seriesNavigation: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}
export default function MusicRail({
  editing,
  publicEmpty,
  seriesNavigation,
  action,
  children,
}: Props) {
  return (
    <aside className="music-rail">
      <div className="music-heading">
        <h1>Music</h1>
        {action}
      </div>
      {!publicEmpty && !editing && seriesNavigation}
      {children}
    </aside>
  );
}
