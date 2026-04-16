import Frame from "./Frame";
export default function FeatureListIllustration() {
  return (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${15 + i * 60}, 20)`}>
          <circle cx="20" cy="18" r="14" fill="#d4d4d8" />
          <rect x="4" y="38" width="32" height="8" rx="2" fill="#e4e4e7" />
          <rect x="2" y="50" width="36" height="5" rx="2" fill="#e4e4e7" />
          <rect x="2" y="59" width="28" height="5" rx="2" fill="#e4e4e7" />
        </g>
      ))}
    </Frame>
  );
}
