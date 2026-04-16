import Frame from "./Frame";
export default function StatsIllustration() {
  return (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${15 + i * 45}, 30)`}>
          <rect x="0" y="0" width="35" height="20" rx="3" fill="#d4d4d8" />
          <rect x="5" y="26" width="25" height="8" rx="2" fill="#e4e4e7" />
        </g>
      ))}
    </Frame>
  );
}
