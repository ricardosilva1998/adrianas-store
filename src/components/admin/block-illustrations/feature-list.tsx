import Frame from "./Frame";
export default function FeatureListIllustration() {
  return (
    <Frame>
      <rect x="60" y="16" width="80" height="4" rx="2" fill="#be185d" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={15 + i * 62} y="34" width="52" height="10" rx="5" fill="#ED7396" />
          <rect x={22 + i * 62} y="52" width="38" height="4" rx="2" fill="#d4d4d8" />
          <rect x={22 + i * 62} y="62" width="28" height="3" rx="1.5" fill="#d4d4d8" />
          <rect x={22 + i * 62} y="70" width="34" height="3" rx="1.5" fill="#d4d4d8" />
        </g>
      ))}
    </Frame>
  );
}
