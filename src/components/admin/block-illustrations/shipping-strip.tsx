import Frame from "./Frame";
export default function ShippingStripIllustration() {
  return (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${10 + i * 46}, 40)`}>
          <circle cx="12" cy="12" r="10" fill="#d4d4d8" />
          <rect x="0" y="28" width="30" height="7" rx="2" fill="#e4e4e7" />
          <rect x="4" y="39" width="22" height="5" rx="2" fill="#e4e4e7" />
        </g>
      ))}
    </Frame>
  );
}
