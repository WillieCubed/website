import LinkedObjectWrapper from './LinkedObjectWrapper';

interface LinkButtonProps {
  href: string;
  icon?: JSX.Element;
  label: string;
}
export function LinkButton({ href, icon, label }: LinkButtonProps) {
  return (
    <LinkedObjectWrapper href={href}>
      <div className="flex align-middle gap-x-sm">
        {icon}
        <span>{label}</span>
      </div>
    </LinkedObjectWrapper>
  );
}
