import Frame from "./Frame";
export default function FaqIllustration() {
  return (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="16" y={18 + i * 28} width="168" height="22" rx="5" fill="#ffffff" stroke="#eaeaea" />
          <rect x="26" y={25 + i * 28} width="100" height="4" rx="2" fill="#d4d4d8" />
          <path d={`M176 ${28 + i * 28} l-4 4 l-4 -4`} stroke="#8a8a8a" fill="none" strokeWidth="1.5" />
        </g>
      ))}
    </Frame>
  );
}
