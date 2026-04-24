import Frame from "./Frame";

export default function SocialLinksIllustration() {
  return (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={25 + i * 44} y="45" width="26" height="26" rx="6" fill="#be185d" />
          <circle cx={38 + i * 44} cy="58" r="5" fill="#fbcfe8" />
        </g>
      ))}
    </Frame>
  );
}
