import Frame from "./Frame";
export default function ProductLongDescriptionIllustration() {
  return (
    <Frame>
      <rect x="20" y="16" width="70" height="6" rx="2" fill="#be185d" />
      {[32, 44, 56, 68, 80, 92].map((y, i) => (
        <rect key={i} x="20" y={y} width={i === 5 ? 90 : 160} height="4" rx="2" fill="#d4d4d8" />
      ))}
    </Frame>
  );
}
