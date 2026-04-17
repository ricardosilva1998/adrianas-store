import { ICON_PATHS, type IconName } from "../../lib/icons";

export default function IconPreview({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
