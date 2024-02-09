export type ProjectData = {
  /**
   * The unique identifier for this project.
   */
  codename: string;
  title: string;
  tagline: string;
  description: string;
  launched: Date;
  roles: string[];
  type: ProjectType;
  projectIconUrl: string;
  thumbnail: string;
  website: string;
  contact: ProjectContactInfo;
  /**
   * A brief descriptor for this artifact noting who the project was for
   * @example "with Develop for Good"
   * @example "for myself"
   */
  clientAttribution: string;
  features: ProjectFeature[];
  artifacts: ProjectArtifact[];
  collaborators: Collaboator[];
  experiences: string[];
  tools: string[];
  skillsApplied: string[];
};

/**
 * A feature of a project.
 */
export type ProjectFeature = {
  label: string;
  description: string;
  imageUrl: string;
  screenshots: string[];
};

/**
 * A project that can be used to learn more about the project.
 */
type ProjectContactInfo = {
  /**
   * The name of the last known primary contact for this project.
   */
  name: string;
  /**
   * The email of the last known primary contact for this project.
   */
  email: string;
};

type Collaboator = {
  name: string;
  link?: string;
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
   *
   * @deprecated No thumbnail is used anymore.
   */
  thumbnailUrl?: string;
};

export type ArtifactType = 'code' | 'website' | 'report' | string;

export type ProjectType =
  | 'research'
  | 'personal'
  | 'organization'
  | 'hackathon';

export const PROJECT_TYPE_MAP: Record<ProjectType, string> = {
  research: 'Research Project',
  personal: 'Personal Project',
  organization: 'Team Project',
  hackathon: 'Hackathon Project',
};
