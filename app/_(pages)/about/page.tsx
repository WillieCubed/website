import type { Metadata } from 'next/types';

export const metadata: Metadata = {
  title: 'About',
  openGraph: {
    siteName: 'Willie Chalmers III',
    // TODO: Update this to be dynamic with some cool stats
    description:
      'Willie Chalmers III builds software for people. Learn more about him here.',
    url: '/',
    type: 'website',
    images: ['/assets/headshot.jpg'],
  },
};

/**
 * An overview of who I am and what I believe along with a small autobiography.
 *
 * Route: /about
 */
export default async function AboutPage() {
  const resumeData = await fetchResumeData();
  return (
    <main>
      <section id="overview">
        <div className="px-4 py-24 max-w-4xl mx-auto text-center">
          <div className="text-headline-medium">
            I develop software and build tools that delight me.
            <br />
            I&apos;m always looking for new opportunities!
          </div>
        </div>
      </section>
      {/* <section id="details" className="md:grid md:grid-cols-12 px-4 py-24">
        <div className="md:col-start-3 md:col-span-8 prose">
          <h1>I build products for people.</h1>
        </div>
      </section> */}
      <section id="resume" className="py-6">
        <div className="p-6 max-w-4xl mx-auto bg-surface-foreground dark:bg-surface-foreground-dark border-black border-2">
          <h1 className="text-headline-large mb-6">Resume</h1>
          <VirtualResume {...resumeData} />
        </div>
      </section>
    </main>
  );
}

const EDUCATION_DATA: EducationItem[] = [
  {
    school: 'The University of Texas at Dallas',
    degree: 'Bachelor of Science',
    subject: 'Computer Science',
    graduationDate: 'August 2023',
    location: 'Richardson, TX',
  },
];

const SERVICE_ACTIVITIES: ServiceActivity[] = [
  {
    group: 'UT Dallas Student Senate',
    positionTitle: 'Senator',
    startDate: 'August 2019',
    endDate: 'April 2023',
  },
  {
    group: 'UT Dallas Student Senate',
    positionTitle: 'Secretary',
    startDate: 'May 2021',
    endDate: 'April 2022',
  },
  {
    group: 'UT Dallas Student Senate Executive Committee',
    positionTitle: 'Member',
    startDate: 'May 2021',
    endDate: 'April 2022',
  },
  {
    group: 'UT Dallas Student Senate Technology Committee',
    positionTitle: 'Member',
    startDate: 'May 2021',
    endDate: 'April 2022',
  },
  {
    group: 'UT Dallas Student Senate Communications Committee',
    positionTitle: 'Member',
    startDate: 'May 2021',
    endDate: 'April 2022',
  },
  {
    group: 'UT Dallas Student Senate Committee on Recording Senate Meetings',
    positionTitle: 'Member',
    startDate: 'November 2022',
    endDate: 'January 2023',
  },
  {
    group: 'UT Dallas Student Senate Homecoming Organizing Committee',
    positionTitle: 'Chair',
    startDate: 'December 2021',
    endDate: 'February 2022',
  },
  {
    group: 'UT Dallas Student Senate Homecoming Organizing Committee',
    positionTitle: 'Member',
    startDate: 'May 2021',
    endDate: 'April 2022',
  },
  {
    group: 'UT Dallas Student Media Operating Board',
    positionTitle: 'Undergraduate Representative',
    startDate: 'September 2022',
    endDate: 'April 2023',
  },
  {
    group: 'UT Dallas Student Government Elections Board',
    positionTitle: 'Chair',
    startDate: 'February 2023',
    endDate: 'March 2023',
  },
  {
    group: 'UT Dallas New Student Engagement Board',
    positionTitle: 'Undergraduate Representative',
    startDate: 'September 2021',
    endDate: 'April 2023',
  },
  {
    group: 'UT Dallas Committee on Educational Technology',
    positionTitle: 'Undergraduate Representative',
    startDate: 'September 2021',
    endDate: 'May 2023',
  },
  {
    group: 'UT Dallas Student Fee Advisory Committee',
    positionTitle: 'Undergraduate Representative',
    startDate: 'September 2021',
    endDate: 'May 2023',
  },
];

const WORK_EXPERIENCES: ResumeExperienceItem[] = [
  {
    positionTitle: 'Research Assistant',
    organization: 'The University of Texas at Dallas',
    startDate: 'June 2022',
    endDate: 'April 2023',
    location: 'Richardson, TX',
    description:
      'Conducted research on multimodal concept learning using vision and language, creating system to learn grounded concept representations using self-supervised learning.',
  },
  {
    positionTitle: 'Peer Advisor',
    organization: 'The University of Texas at Dallas',
    startDate: 'June 2022',
    endDate: 'July 2022',
    location: 'Richardson, TX',
    description:
      'Served as a resident advisor and organized social and professional development events for 70+ incoming freshmen as part of the Anson L. Clark Summer Research Program.',
  },
  {
    positionTitle: 'Research Engineer Intern',
    organization: 'The University of Texas at Dallas',
    startDate: 'September 2019',
    endDate: 'December 2021',
    location: 'Richardson, TX',
    description:
      'Developed and tested Java-based and Python-based tools to train AI agents to perform tasks in open-world environments.',
  },
  {
    positionTitle: 'Video Editor',
    organization: 'The University of Texas at Dallas',
    startDate: 'September 2019',
    endDate: 'January 2020',
    location: 'Richardson, TX',
    description:
      'Operated cameras for livestream broadcasts of various sporting events as part of video production team, filming and editing player profiles and other video content.',
  },
  {
    positionTitle: 'Undergraduate Researcher',
    organization: 'The University of Texas at Dallas',
    startDate: 'June 2019',
    endDate: 'August 2019',
    location: 'Richardson, TX',
    description:
      'Built convolutional neural network machine learning architecture and applied transfer learning to detect relationships between objects in images.',
  },
];

const VOLUNTEER_POSITIONS: ResumeExperienceItem[] = [
  {
    organization: 'UT Dallas Student Government',
    positionTitle: 'Secretary',
    startDate: 'May 2021',
    endDate: 'April 2022',
    location: 'Richardson, TX',
    description:
      'Served as the chief information of the Student Government of The University of Texas at Dallas, maintaining records of all meetings and actions of the Student Senate and the Student Government Executive Committee. Served as parlimantarian for the Student Senate and resolved questions of parliamentary procedure.',
  },
  {
    organization: 'Association for Computing Machinery at UT Dallas',
    positionTitle: 'Head of Engineering',
    startDate: 'April 2021',
    endDate: 'March 2022',
    location: 'Richardson, TX',
    description:
      'Provided technical leadership to two cross-functional engineering teams using agile development practices, deploying campus-scale web applications and services used by over 1,000 students. Mitigated service disruptions and security incidents. Collaborated with product designers to create user interfaces and user experiences for student-facing web applications.',
  },
  {
    organization: 'Artificial Intelligence Society',
    positionTitle: 'Director of Projects and Technology',
    startDate: 'November 2020',
    endDate: 'May 2021',
    location: 'Richardson, TX',
    description:
      "Oversaw AI mentorship program, matching students with mentors and providing resources to help students learn about AI. Organized and led workshops on AI and machine learning. Developed and deployed web applications to support the organization's operations, overhauling events website with new design and JAMstack-based CMS.",
  },
];

async function fetchResumeData(): Promise<ResumeCV> {
  return {
    summary: '',
    education: EDUCATION_DATA,
    experience: WORK_EXPERIENCES,
    service: SERVICE_ACTIVITIES,
    publications: [],
    talks: [],
    volunteerism: VOLUNTEER_POSITIONS,
    awards: [],
  };
}

function VirtualResume({
  education,
  experience,
  service,
  publications,
  talks,
  volunteerism,
  awards,
}: ResumeCV) {
  return (
    <div className="space-y-8">
      {education.length > 0 && (
        <section id="education" className="space-y-6">
          <h1 className="text-headline-medium">Education</h1>
          <ResumeEducationList items={education} />
        </section>
      )}
      {experience.length > 0 && (
        <section id="experience" className="space-y-6">
          <h1 className="text-headline-medium">Employment History</h1>
          <ResumeExperienceList items={experience} />
        </section>
      )}
      {volunteerism.length > 0 && (
        <section id="volunteerism" className="space-y-6">
          <h1 className="text-headline-medium">Other Experience</h1>
          <ResumeExperienceList items={volunteerism} />
        </section>
      )}
      {talks.length > 0 && (
        <section id="talks" className="space-y-6">
          <h1 className="text-headline-medium">
            Invited Talks &amp; Presentations
          </h1>
          {/* <ResumeExperienceList items={talks} /> */}
        </section>
      )}
      {awards.length > 0 && (
        <section id="awards" className="space-y-6">
          <h1 className="text-headline-medium">Awards &amp; Honors</h1>
          {/* <ResumeExperienceList items={experience} /> */}
        </section>
      )}
    </div>
  );
}

type ResumeCV = {
  summary: string;
  education: EducationItem[];
  experience: ResumeExperienceItem[];
  volunteerism: ResumeExperienceItem[];
  service: ServiceActivity[];
  publications: PublicationItem[];
  talks: PresentationItem[];
  awards: AwardItem[];
};

type EducationItem = {
  school: string;
  degree: string;
  subject: string;
  location: string;
  graduationDate: string;
};

type ResumeExperienceItem = {
  organization: string;
  positionTitle: string;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
};

type AwardItem = {
  type: 'award' | 'scholarship' | 'honor';
  title: string;
  date: string;
  description: string;
};

type PublicationItem = {
  title: string;
  authors: string[];
  date: string;
  url: string;
};

type ProfessionalAffiliationItem = {
  organization: string;
  positionTitle: string;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
};

/**
 * An invited talk, presentation, or workshop.
 */
type PresentationItem = {
  title: string;
  date: string;
  location: string;
  description: string;
};

type ServiceActivity = {
  group: string;
  positionTitle: string;
  startDate: string;
  endDate: string;
};

function ResumeEducationList({ items }: { items: EducationItem[] }) {
  const educationItems = items.map(
    ({ school, degree, subject, location, graduationDate }) => (
      <li key={school + subject} className="space-y-2">
        <div className="md:flex md:justify-between">
          <div className="text-headline-small">
            {degree} in {subject}
          </div>
          <div className="text-headline-small">{graduationDate}</div>
        </div>
        <div className="md:flex md:justify-between">
          <div className="text-title-large text-emphasis-low">{school}</div>
          <div className="text-title-large text-emphasis-low">{location}</div>
        </div>
      </li>
    )
  );
  return <ul className="space-y-6">{educationItems}</ul>;
}

function ResumeExperienceList({ items }: { items: ResumeExperienceItem[] }) {
  const experienceItems = items.map(
    ({
      positionTitle,
      organization,
      startDate,
      endDate,
      location,
      description,
    }) => (
      <li key={positionTitle + organization} className="space-y-2">
        <div className="md:flex md:justify-between md:space-x-4">
          <div className="font-display text-headline-small">
            {positionTitle}
          </div>
          <div className="text-title-large">
            {startDate} &ndash; {endDate}
          </div>
        </div>
        <div className="md:flex md:justify-between md:space-x-4">
          <div className="text-title-large text-emphasis-low">
            {organization}
          </div>
          <div className="text-title-large text-emphasis-low">{location}</div>
        </div>
        <div className="pt-2 text-body-medium">{description}</div>
      </li>
    )
  );

  return <ul className="space-y-6">{experienceItems}</ul>;
}

function BigWordsBox({ children }: React.PropsWithChildren) {
  return (
    <section className="h-[60vh] py-16 flex">
      <blockquote className="my-auto max-w-6xl ml-48 p-16 text-[72px] font-display font-semibold bg-white/[0.13]">
        {children}
      </blockquote>
    </section>
  );
}
