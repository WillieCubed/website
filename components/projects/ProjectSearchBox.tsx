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
        className="w-full px-4 h-[48px] text-label-large border-2 border-black "
        type="text"
        placeholder="Search"
        value={query}
        onChange={handleSearchQueryChange}
      />
    </div>
  );
}
