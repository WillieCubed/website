import SiteLink from '@/components/link/SiteLink';
import SharedTitle from '@/components/site/SharedTitle';

import { ventures } from '@/lib/home/ventures';

export default function ProfileWork({ ids }: { ids: string[] }) {
  const work = ventures.filter(
    (venture) => !venture.hidden && ids.includes(venture.id)
  );

  return (
    <ul className="profile-work">
      {work.map((venture) => (
        <li key={venture.id}>
          <SiteLink
            href={`/?detail=${venture.id}`}
            preview={false}
            className="profile-work__link"
          >
            <div className="profile-work__heading">
              <h3 className="text-title-large">
                <SharedTitle id={`venture-${venture.id}`} size="small">
                  <span className="inline-block">{venture.name}</span>
                </SharedTitle>
              </h3>
              <span aria-hidden="true" className="profile-work__arrow">
                ↗
              </span>
            </div>
            {venture.detail.body.map((paragraph) => (
              <p key={paragraph} className="text-body-large text-muted">
                {paragraph}
              </p>
            ))}
          </SiteLink>
        </li>
      ))}
    </ul>
  );
}
