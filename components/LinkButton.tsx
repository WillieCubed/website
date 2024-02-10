import LinkedObjectWrapper from './LinkedObjectWrapper';

interface LinkButtonProps {
  href: string;
  icon?: JSX.Element;
  label: string;
  openInNewTab?: boolean;
}
export function LinkButton({
  href,
  icon,
  label,
  openInNewTab,
}: LinkButtonProps) {
  return (
    <LinkedObjectWrapper href={href} openInNewTab={openInNewTab}>
      <div className="flex align-middle gap-x-sm">
        {icon}
        <span>{label}</span>
      </div>
    </LinkedObjectWrapper>
  );
}
