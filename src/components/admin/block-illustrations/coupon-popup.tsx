import Frame from "./Frame";
export default function CouponPopupIllustration() {
  return (
    <Frame>
      <rect x="0" y="0" width="200" height="120" fill="#0f172a" opacity="0.18" />
      <rect x="40" y="20" width="120" height="80" rx="8" fill="#ffffff" stroke="#fbcfe8" stroke-width="2" />
      <rect x="55" y="35" width="60" height="6" rx="2" fill="#0f172a" />
      <rect x="55" y="46" width="80" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="60" y="58" width="80" height="14" rx="3" fill="#fbcfe8" stroke="#ec4899" stroke-width="1" stroke-dasharray="3 2" />
      <text x="100" y="69" font-family="monospace" font-size="9" font-weight="700" fill="#be185d" text-anchor="middle">PROMO10</text>
      <rect x="60" y="80" width="80" height="10" rx="5" fill="#ec4899" />
      <circle cx="148" cy="32" r="6" fill="#ffffff" stroke="#94a3b8" />
      <path d="M145 29 l6 6 m-6 0 l6 -6" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" />
    </Frame>
  );
}
