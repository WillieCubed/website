import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ProjectPage from '@/components/projects/ProjectPage';

import { getInitiative } from '@/lib/initiatives';
import { childrenOf, getProject, getProjects } from '@/lib/projects';
import { pageMetadata } from '@/lib/site';

// Cache Components refuses an empty list, and every project is a draft in
// production until Willie clears the flag, so an underscore path stands in.
// The loader skips underscore files, so it prerenders as a plain 404.
export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.length > 0
    ? projects.map((project) => ({ codename: project.slug }))
    : [{ codename: '_' }];
}

export async function generateMetadata(props: {
  params: Promise<{ codename: string }>;
}): Promise<Metadata> {
  const { codename } = await props.params;
  const project = await getProject(codename);
  if (!project) notFound();
  return pageMetadata({
    title: project.title,
    description: project.line ?? project.title,
    path: project.href,
    image: `${project.href}/opengraph-image`,
  });
}

export default async function Page(props: {
  params: Promise<{ codename: string }>;
}) {
  const { codename } = await props.params;
  const projects = await getProjects();
  const project = projects.find((item) => item.slug === codename);
  if (!project) notFound();
  const bySlug = (slug?: string) =>
    slug ? (projects.find((item) => item.slug === slug) ?? null) : null;
  const initiative = project.initiative
    ? await getInitiative(project.initiative).catch(() => null)
    : null;
  return (
    <ProjectPage
      project={project}
      parent={bySlug(project.parent)}
      childProjects={childrenOf(projects, project.slug)}
      successor={
        project.successor?.startsWith('https://')
          ? null
          : bySlug(project.successor)
      }
      initiative={
        initiative ? { title: initiative.title, href: initiative.href } : null
      }
    />
  );
}
