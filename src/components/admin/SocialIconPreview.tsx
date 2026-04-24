import { SOCIAL_ICON_PATHS, type SocialIconName } from "../../lib/icons";

export function SocialIconPreview({
  name,
  className = "h-5 w-5",
}: {
  name: SocialIconName;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={SOCIAL_ICON_PATHS[name]} />
    </svg>
  );
}
