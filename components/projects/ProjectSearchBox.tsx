import { useState } from 'react';

interface ProjectSearchBoxProps {
  query: string;
  onUpdate: (query: string) => void;
}

export default function ProjectSearchBox({
  query,
  onUpdate,
}: ProjectSearchBoxProps) {
  const handleSearchQueryChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onUpdate(event.target.value);
  };

  return (
    <div className="bg-surface-foreground">
      <input
        className="h-[48px] w-full border-2 border-outline bg-surface-container-lowest px-4 text-label-large text-on-surface"
        type="text"
        placeholder="Search"
        value={query}
        onChange={handleSearchQueryChange}
      />
    </div>
  );
}
