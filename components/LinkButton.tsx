import Link from "next/link";

interface LinkButtonProps {
  href: string;
  variant?: "primary" | "secondary";
}

/**
 * A custom link button that supports multiple styles.
 */
export default function LinkButton({
  href,
  variant = "primary",
  children,
}: React.PropsWithChildren<LinkButtonProps>) {
  return (
    <Link
      href={href}
      className={`inline-block p-[12px] border border-black border-4 font-semibold font-display text-2xl hover:shadow-xl ${variant === "primary" ? "bg-primary-dark-2 text-white" : ""
        }`}
    >
      {children}
    </Link>
  );
}
