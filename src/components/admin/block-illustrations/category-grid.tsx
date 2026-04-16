import Frame from "./Frame";
export default function CategoryGridIllustration() {
  return (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={40 + i * 60} cy="50" r="22" fill="#fbcfe8" />
          <rect x={22 + i * 60} y="84" width="36" height="4" rx="2" fill="#d4d4d8" />
        </g>
      ))}
    </Frame>
  );
}
