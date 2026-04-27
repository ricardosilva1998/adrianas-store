import Frame from "./Frame";
export default function IntroHeroIllustration() {
  return (
    <Frame>
      <rect x="10" y="10" width="180" height="100" rx="6" fill="#0f172a" />
      <rect x="10" y="10" width="180" height="100" rx="6" fill="#fbcfe8" opacity="0.18" />
      <rect x="62" y="38" width="76" height="6" rx="2" fill="#ffffff" />
      <rect x="68" y="50" width="64" height="4" rx="2" fill="#ffffff" opacity="0.7" />
      <rect x="80" y="62" width="40" height="10" rx="5" fill="#f472b6" />
      <path d="M100 86 l0 14 m-6 -6 l6 6 l6 -6" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    </Frame>
  );
}
