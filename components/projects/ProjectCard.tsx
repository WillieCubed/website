'use client';

import Link from 'next/link';
import { ProjectData, PROJECT_TYPE_MAP } from '../../lib/common';

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
      <Link
        key={name + link}
        href={link}
        className="underline font-mono font-semibold"
      >
        {name}
      </Link>
    ) : (
      <span className="underline font-mono font-semibold">{name}</span>
    );
  });

  const artifactsItems = artifacts.map(({ label, url }) => {
    return (
      <Link
        key={label + url}
        href={url}
        className="inline-block p-3 bg-slate-300 text-on-light"
      >
        <div className="font-mono font-semibold">{label}</div>
      </Link>
    );
  });

  const isResearch = type === 'research';

  const isDisplayOnly = mode === 'expanded';

  return (
    <article
      className={`p-[16px] lg:p-[32px] mb-4 border-[4px] border-black bg-white text-on-light dark:bg-dark dark:text-on-dark ${
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
            <div className="uppercase font-bold font-display text-sm text-primary-dark-1">
              Collaborators
            </div>
            <div className="space-x-4">{collaboratorsItems}</div>
          </div>
        )}
        {/* {isResearch && subjects.length > 0 && (
          <div className="space-y-2">
            <div className="uppercase font-bold font-display text-sm text-primary-dark-1">
              Topics
            </div>
            <div className="space-y-2">{subjectTags}</div>
          </div>
        )} */}
        <div className="space-y-2">
          <div className="uppercase font-bold font-display text-sm text-primary-dark-1">
            Overview
          </div>
          <p className="font-semibold font-display">{tagline}</p>
        </div>
        {/* {isResearch && questions && questions.length > 0 && (
          <div className="space-y-2">
            <div className="uppercase font-bold font-display text-sm text-primary-dark-1">
              Questions Addressed
            </div>
            <ul className="space-y-2">{questionsContent}</ul>
          </div>
        )} */}
        {artifacts && (
          <div className="space-y-2">
            <div className="uppercase font-bold font-display text-sm text-primary-dark-1">
              Artifacts
            </div>
            <div className="space-x-4">{artifactsItems}</div>
          </div>
        )}
      </div>
      {!isDisplayOnly && (
        <div className="mt-4">
          <Link
            href={`/projects/${codename} `}
            className="underline font-bold font-display"
          >
            Read more
          </Link>
        </div>
      )}
    </article>
  );
}
