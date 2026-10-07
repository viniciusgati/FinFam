import { NAV_ICONS } from "@/lib/nav-icons";
import type { NavIconName } from "@/lib/navigation";

interface NavIconProps {
  name: NavIconName;
  className?: string;
}

export default function NavIcon({ name, className }: NavIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {NAV_ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
