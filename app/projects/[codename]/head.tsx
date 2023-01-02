import { getProject, getProjects, ProjectData } from '../../../lib/projects';
import { ProjectDetailPageParams } from './page';

/**
 * Head for the /projects/[codename] route.
 *
 * This injects OpenGraph Project tags with information specific to the project
 * with the given codename.
 */
export default async function Head({
  params: { codename },
}: {
  params: ProjectDetailPageParams;
}) {
  const projectData = await getProject(codename);

  return (
    <>
      <title>{projectData.name} - Willie Chalmers III</title>
      <meta name="description" content={projectData?.overview} />
      <link rel="icon" href="/favicon.ico" />

      <meta property="og:site_name" content="Willie Chalmers III" />
      <meta property="og:title" content={projectData.name} />
      <meta property="og:description" content={projectData.overview} />
      {/* TODO: Choose a different image for a project */}
      <meta property="og:image" content="/assets/headshot.jpg" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={generateProjectUrl(projectData)} />
    </>
  );
}

const BASE_URL = 'https://williecubed.me/projects';

/**
 * Generate a canonical URL for a project's meta social information.
 */
function generateProjectUrl({ codename }: ProjectData) {
  return `${BASE_URL}/${codename}`;
}
