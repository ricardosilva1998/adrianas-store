import Frame from "./Frame";
export default function ImageCarouselIllustration() {
  return (
    <Frame>
      <rect x="20" y="25" width="160" height="70" rx="6" fill="#fbcfe8" />
      <rect x="28" y="32" width="144" height="56" rx="3" fill="#f9a8d4" opacity="0.5" />
      <circle cx="35" cy="60" r="5" fill="#ffffff" opacity="0.9" />
      <circle cx="165" cy="60" r="5" fill="#ffffff" opacity="0.9" />
      <rect x="86" y="100" width="6" height="3" rx="1.5" fill="#ec4899" />
      <rect x="96" y="100" width="14" height="3" rx="1.5" fill="#ec4899" />
      <rect x="114" y="100" width="6" height="3" rx="1.5" fill="#ec4899" opacity="0.5" />
    </Frame>
  );
}
