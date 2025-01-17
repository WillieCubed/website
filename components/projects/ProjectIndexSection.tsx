'use client';

import { useState } from 'react';

import ProjectSearchBox from './ProjectSearchBox';

interface ProjectIndexSelection {
  /**
   * An initial query used to populate the results, which can be
   */
  initialQuery: string;
}

export default function ProjectIndexSection({
  initialQuery = '',
}: ProjectIndexSelection) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  const handleUpdate = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <div className="md:grid md:grid-cols-5 space-y-xl">
      <div className="max-w-3xl">
        <ProjectSearchBox onUpdate={handleUpdate} query={searchQuery} />
      </div>
      <ProjectIndexList />
    </div>
  );
}

function ProjectIndexList() {
  return (
    <table>
      <thead>
        <tr>
          <th className="p-2 text-title-medium">Project</th>
          <th className="p-2 text-title-medium">Started</th>
          <th className="p-2 text-title-medium">Launched</th>
          <th className="p-2 text-title-medium">Type</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  );
}

interface ProjectIndexItemProps {
  name: string;
}

function ProjectIndexItem() {}
