import Frame from "./Frame";
export default function TestimonialsIllustration() {
  return (
    <Frame>
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x={15 + i * 92} y="24" width="80" height="70" rx="8" fill="#ffffff" stroke="#eaeaea" />
          <circle cx={35 + i * 92} cy="40" r="8" fill="#fbcfe8" />
          <rect x={47 + i * 92} y={36} width="40" height="4" rx="2" fill="#d4d4d8" />
          <rect x={22 + i * 92} y={60} width="66" height="4" rx="2" fill="#d4d4d8" />
          <rect x={22 + i * 92} y={70} width="56" height="4" rx="2" fill="#d4d4d8" />
        </g>
      ))}
    </Frame>
  );
}
