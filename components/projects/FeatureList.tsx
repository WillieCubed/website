export default function FeatureSectionWrapper() {
  return (
    <div className="inline-flex flex-col items-start gap-y-xl">
      <h1 className="text-headline-small text-on-surface-foreground dark:text-on-surface-foreground-dark">
        Features
      </h1>
      <FeatureList />
    </div>
  );
}

type Feature = {
  title: string;
  description: string;
  image?: string;
};

interface FeatureListProps {
  features: Feature[];
}

function FeatureList() {
  return (
    <div className="flex flex-start flex-wrap items-start md:columns-2 lg:columns-3">
      test
    </div>
  );
}

function FeatureCard() {
  return <div></div>;
}
