import Image from 'next/image';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import type { ProjectCard } from '@/lib/projects/catalog';

import './projects-index.css';

interface ProjectsIndexProps {
  title: string;
  description: string;
  current: ProjectCard[];
  projects: ProjectCard[];
}

export default function ProjectsIndex({
  title,
  description,
  current,
  projects,
}: ProjectsIndexProps) {
  return (
    <main id="main" className="projects-index">
      <header className="projects-index-head">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div>
        {current.length > 0 && (
          <section
            className="projects-section"
            aria-labelledby="current-work-heading"
          >
            <h2 id="current-work-heading">Current work</h2>
            <CardGrid cards={current} />
          </section>
        )}
        {projects.length > 0 && (
          <section
            className="projects-section"
            aria-labelledby="project-pages-heading"
          >
            <h2 id="project-pages-heading">Projects</h2>
            <CardGrid cards={projects} />
          </section>
        )}
      </div>
    </main>
  );
}

function CardGrid({ cards }: { cards: ProjectCard[] }) {
  return (
    <ul className="projects-grid">
      {cards.map((card) => (
        <li key={card.id}>
          <SiteLink
            href={card.href}
            preview={false}
            className={`projects-card${card.image ? '' : ' projects-card-text'}`}
            style={schemeStyleFromHex(card.brand)}
          >
            {card.image && (
              <div
                className={`projects-card-media${card.image.portrait ? ' projects-card-portrait' : ''}`}
              >
                <Image
                  src={card.image.src}
                  alt={card.image.alt}
                  fill
                  sizes="(min-width: 840px) 390px, (min-width: 600px) 46vw, 100vw"
                  style={{
                    objectPosition: card.image.fromLeft
                      ? 'left center'
                      : undefined,
                  }}
                  unoptimized={card.image.src.endsWith('.svg')}
                />
              </div>
            )}
            <div className="projects-card-copy">
              {card.context && (
                <p className="projects-card-context">{card.context}</p>
              )}
              <div className="projects-card-heading">
                <h3>{card.title}</h3>
                <span className="projects-card-arrow">
                  <Icon name="arrow-right" size={20} />
                </span>
              </div>
              {card.description && (
                <p className="projects-card-description">{card.description}</p>
              )}
            </div>
          </SiteLink>
        </li>
      ))}
    </ul>
  );
}
