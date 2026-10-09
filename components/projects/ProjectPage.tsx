import InitiativeBody from '@/components/initiatives/InitiativeBody';
import SiteLink from '@/components/link/SiteLink';
import TopBar from '@/components/site/TopBar';

import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import type { Project } from '@/lib/projects';
import { projectSeed } from '@/lib/projects/brand';
import { projectFacts, projectLinkChips } from '@/lib/projects/facts';

import ProjectMedia from './ProjectMedia';
import './project-page.css';

interface ProjectPageProps {
  project: Project;
  parent: Project | null;
  childProjects: Project[];
  successor: Project | null;
  initiative: { title: string; href: string } | null;
}

/**
 * A project's own page: the facts Willie recorded, then his write-up. A
 * facts-only project reaches here with no body and no media, so the page
 * shows just the header.
 */
export default function ProjectPage({
  project,
  parent,
  childProjects,
  successor,
  initiative,
}: ProjectPageProps) {
  const crumbs = [
    { label: 'Projects', href: '/projects' },
    ...(parent ? [{ label: parent.title, href: parent.href }] : []),
    { label: project.title, href: project.href },
  ];
  const [hero, ...more] = project.visibility === 'public' ? project.media : [];
  const chips = projectLinkChips(project, { initiative, successor });

  return (
    <div
      className={hero ? 'project project-has-hero' : 'project'}
      style={schemeStyleFromHex(projectSeed(project))}
    >
      <div className="project-topbar">
        <TopBar crumbs={crumbs} column="reading" />
      </div>
      <main id="main">
        <div className="project-band">
          <div className="project-head">
            <h1>{project.title}</h1>
            {project.line && <p className="project-line">{project.line}</p>}
            <p className="project-facts">
              {projectFacts(project).map((fact) => (
                <span key={fact}>{fact}</span>
              ))}
            </p>
            {project.collaborators.length > 0 && (
              <p className="project-facts">
                {project.collaborators.map((person) =>
                  person.href ? (
                    <SiteLink key={person.name} href={person.href}>
                      {person.name}
                    </SiteLink>
                  ) : (
                    <span key={person.name}>{person.name}</span>
                  )
                )}
              </p>
            )}
            {chips.length > 0 && (
              <div className="project-links">
                {chips.map((chip, index) => (
                  <SiteLink
                    key={`${index}:${chip.href}`}
                    href={chip.href}
                    className={chip.primary ? 'primary' : undefined}
                  >
                    {chip.label}
                  </SiteLink>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="project-main">
          {hero && <ProjectMedia media={hero} hero />}
          {project.content && <InitiativeBody source={project.content} />}
          {more.map((media, index) => (
            <ProjectMedia key={index} media={media} />
          ))}
          {childProjects.length > 0 && (
            <ol className="project-children">
              {childProjects.map((child) => (
                <li key={child.slug}>
                  <SiteLink href={child.href} preview={false}>
                    <b>{child.title}</b>
                    {child.line && <span>{child.line}</span>}
                  </SiteLink>
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>
    </div>
  );
}
