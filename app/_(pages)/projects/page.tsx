import SiteLink from '@/components/link/SiteLink';

import { getProjects } from '@/lib/projects';
import { pageMetadata } from '@/lib/site';

export async function generateMetadata() {
  return pageMetadata({
    title: 'Projects',
    description: 'Apps and other things Willie has built.',
    path: '/projects',
  });
}

/**
 * Parked until Willie picks a list layout on the projects canvas. It only
 * has to compile against lib/projects in the meantime.
 */
export default async function ProjectsPage() {
  const projects = await getProjects();
  return (
    <main className="mx-auto max-w-[840px] px-5 py-16">
      <h1 className="text-display-small">Projects</h1>
      <ol className="mt-8 space-y-4">
        {projects.map((project) => (
          <li key={project.slug}>
            <SiteLink href={project.href}>{project.title}</SiteLink>
          </li>
        ))}
      </ol>
    </main>
  );
}
