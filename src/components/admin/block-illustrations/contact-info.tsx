import Frame from "./Frame";
export default function ContactInfoIllustration() {
  return (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx="28" cy={26 + i * 20} r="6" fill="#fbcfe8" />
          <rect x="42" y={23 + i * 20} width="120" height="4" rx="2" fill="#d4d4d8" />
        </g>
      ))}
    </Frame>
  );
}
