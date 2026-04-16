import Frame from "./Frame";
export default function StatsIllustration() {
  return (
    <Frame>
      <rect x="20" y="14" width="80" height="4" rx="2" fill="#be185d" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={15 + i * 44} y="34" width="38" height="20" rx="4" fill="#ED7396" />
          <rect x={20 + i * 44} y="66" width="28" height="4" rx="2" fill="#d4d4d8" />
        </g>
      ))}
    </Frame>
  );
}
