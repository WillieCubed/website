import projects from '../data/projects.json';

export type ProjectData = {
  codename: string;
  type: ProjectType;
  name: string;
  collaborators: Collaboator[];
  subjects: string[];
  /**
   * A brief description of the project.
   */
  overview: string;
  questions: Question[];
  artifacts: ProjectArtifact[];
  repository?: string;
  /**
   * @deprecated Use `artifacts` instead.
   */
  website: string;
  /**
   * @deprecated This field isn't used anymore.
   */
  docs: string;
  bundle: string;
  lastUpdated: string;
};

type Collaboator = {
  name: string;
  url?: string;
};

type ProjectArtifact = {
  type: ArtifactType;
  /**
   * A brief descriptor for this artifact.
   *
   * @example Code on GitHub
   */
  label: string;

  /**
   * An external link to the resource.
   */
  url: string;

  /**
   * An optional thumbnail.
   *
   * If this isn't provided, the UI should display a placeholder image.
   */
  thumbnailUrl?: string;
};

export type ArtifactType = (string & 'code') | 'website' | '';

type Question = {
  /**
   * A unique hyphen-separated word or phrase used to identify this project.
   */
  codename: string;
  /**
   * The raw question text.
   */
  content: string;
  /**
   * Expanded information about the question.
   */
  description: string;
};

export type ProjectType = 'research' | 'personal';

export async function getProjects(): Promise<ProjectData[]> {
  return projects as ProjectData[];
}

/**
 * Fetches the data for a project.
 *
 * @param codename The UID of the project.
 *
 * @returns The corresponding project data.
 */
export async function getProject(codename: string): Promise<ProjectData> {
  const projects = await getProjects();
  const projectData = projects.find((project) => project.codename === codename);
  if (!projectData) {
    throw new Error(
      `Project with given codename "${codename}" cannot be found.`
    );
  }
  return projectData;
}
