import Frame from "./Frame";
export default function ImageTextSplitIllustration() {
  return (
    <Frame>
      <rect x="12" y="16" width="80" height="88" rx="8" fill="#fbcfe8" />
      <rect x="102" y="30" width="80" height="4" rx="2" fill="#be185d" />
      {[44, 56, 68, 80].map((y, i) => (
        <rect key={i} x="102" y={y} width={i === 3 ? 50 : 80} height="4" rx="2" fill="#d4d4d8" />
      ))}
    </Frame>
  );
}
