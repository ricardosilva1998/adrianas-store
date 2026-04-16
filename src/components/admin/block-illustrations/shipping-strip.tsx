import Frame from "./Frame";
export default function ShippingStripIllustration() {
  return (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx={25 + i * 44} cy="60" r="8" fill="#fbcfe8" />
          <rect x={37 + i * 44} y="52" width="32" height="4" rx="2" fill="#be185d" />
          <rect x={37 + i * 44} y="62" width="24" height="3" rx="1.5" fill="#d4d4d8" />
        </g>
      ))}
    </Frame>
  );
}
