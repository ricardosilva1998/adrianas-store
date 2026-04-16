import Frame from "./Frame";
export default function ProductGridIllustration() {
  return (
    <Frame>
      <rect x="20" y="14" width="80" height="4" rx="2" fill="#be185d" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={15 + i * 44} y="30" width="38" height="70" rx="6" fill="#fbcfe8" />
      ))}
    </Frame>
  );
}
