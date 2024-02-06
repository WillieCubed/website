interface SocialContactChipProps {
  href: string;
  icon: JSX.Element;
  label: string;
}
export function SocialContactChip({
  href,
  icon,
  label,
}: SocialContactChipProps) {
  return (
    <a href={href} className="group">
      <div className="flex items-center space-x-2 p-1">
        <div className="h-6 w-6">{icon}</div>
        <div className="text-on-surface group-hover:underline">{label}</div>
      </div>
    </a>
  );
}
