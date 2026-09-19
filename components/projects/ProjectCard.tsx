'use client';

import SiteLink from '@/components/link/SiteLink';

import { PROJECT_TYPE_MAP, ProjectData } from '@/lib/common';

interface ProjectCardProps extends ProjectData {
  mode?: 'default' | 'expanded';
}

/**
 * A card that displays overview information about a project.
 *
 * This card displays as a block and relies on a parent to determine its sizing.
 */
export default function ProjectCard({
  codename,
  title,
  type,
  tagline,
  collaborators,
  artifacts,
  mode = 'default',
}: ProjectCardProps) {
  const typeLabel = PROJECT_TYPE_MAP[type];

  const collaboratorsItems = collaborators?.map(({ name, link }) => {
    return link ? (
      <SiteLink
        preview={false}
        key={name + link}
        href={link}
        className="underline font-mono font-semibold"
      >
        {name}
      </SiteLink>
    ) : (
      <span className="underline font-mono font-semibold">{name}</span>
    );
  });

  const artifactsItems = artifacts.map(({ label, url }) => {
    return (
      <SiteLink
        preview={false}
        key={label + url}
        href={url}
        className="inline-block bg-surface-container-high p-3 text-on-surface"
      >
        <div className="font-mono font-semibold">{label}</div>
      </SiteLink>
    );
  });

  const isResearch = type === 'research';

  const isDisplayOnly = mode === 'expanded';

  return (
    <article
      className={`mb-4 border-[4px] border-outline bg-surface-container-lowest p-[16px] text-on-surface lg:p-[32px] ${
        isDisplayOnly ? '' : 'hover:shadow-lg'
      } transition snap-start`}
    >
      <div>
        <div className="uppercase font-bold font-display text-sm">
          {typeLabel}
        </div>
        <div className="mt-2 font-display text-headline-large text-primary">
          {title}
        </div>
      </div>
      <div className="mt-6 space-y-6">
        {isResearch && collaborators && (
          <div className="space-y-2">
            <div className="font-display text-sm font-bold uppercase text-primary">
              Collaborators
            </div>
            <div className="space-x-4">{collaboratorsItems}</div>
          </div>
        )}
        {/* {isResearch && subjects.length > 0 && (
          <div className="space-y-2">
            <div className="font-display text-sm font-bold uppercase text-primary">
              Topics
            </div>
            <div className="space-y-2">{subjectTags}</div>
          </div>
        )} */}
        <div className="space-y-2">
          <div className="font-display text-sm font-bold uppercase text-primary">
            Overview
          </div>
          <p className="font-semibold font-display">{tagline}</p>
        </div>
        {/* {isResearch && questions && questions.length > 0 && (
          <div className="space-y-2">
            <div className="font-display text-sm font-bold uppercase text-primary">
              Questions Addressed
            </div>
            <ul className="space-y-2">{questionsContent}</ul>
          </div>
        )} */}
        {artifacts && (
          <div className="space-y-2">
            <div className="font-display text-sm font-bold uppercase text-primary">
              Artifacts
            </div>
            <div className="space-x-4">{artifactsItems}</div>
          </div>
        )}
      </div>
      {!isDisplayOnly && (
        <div className="mt-4">
          <SiteLink
            preview={false}
            href={`/projects/${codename} `}
            className="underline font-bold font-display"
          >
            Read more
          </SiteLink>
        </div>
      )}
    </article>
  );
}
