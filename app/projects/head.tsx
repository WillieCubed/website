import { getProjects } from '../../lib/projects';

export default async function Head({}: { params: {} }) {
  const projects = await getProjects();
  const count = projects.length;
  return (
    <>
      <title>Projects Overview - Willie Chalmers III</title>
      <meta
        name="description"
        content={`Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. See his ${count} projects here.`}
      />
      <link rel="icon" href="/favicon.ico" />

      <meta property="og:site_name" content="Willie Chalmers III" />
      <meta property="og:title" content="Projects Overview" />
      <meta
        property="og:description"
        content={`Willie Chalmers III works on research and personal projects for business and for pleasure. see all ${count} of them here.`}
      />
      <meta property="og:image" content="/assets/headshot.jpg" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://williecubed.me/projects" />
    </>
  );
}
