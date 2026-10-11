import ProjectsIndex from '@/components/projects/ProjectsIndex';
import JsonLd from '@/components/seo/JsonLd';
import TopBar from '@/components/site/TopBar';

import { getPublishedProjects } from '@/lib/projects';
import { currentWorkCards, projectToCard } from '@/lib/projects/catalog';
import { graph, personLd, webPageLd, websiteLd } from '@/lib/seo/jsonld';
import { pageMetadata, sitePage } from '@/lib/site';

const PAGE = sitePage('/projects');

export const metadata = pageMetadata({
  title: PAGE.label,
  description: PAGE.description,
  path: PAGE.path,
});

export default async function ProjectsPage() {
  const projects = (await getPublishedProjects()).map(projectToCard);
  const current = currentWorkCards();
  return (
    <>
      <JsonLd
        data={graph(
          webPageLd({
            type: 'CollectionPage',
            name: PAGE.label,
            description: PAGE.description,
            path: PAGE.path,
            items: [...current, ...projects].map((item) => ({
              name: item.title,
              path: item.href,
            })),
          }),
          websiteLd(),
          personLd()
        )}
      />
      <TopBar
        column="content"
        crumbs={[{ label: PAGE.label, href: PAGE.path }]}
      />
      <ProjectsIndex
        title={PAGE.label}
        description={PAGE.description}
        current={current}
        projects={projects}
      />
    </>
  );
}
