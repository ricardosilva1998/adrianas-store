import Frame from "./Frame";
export default function TextIllustration() {
  return (
    <Frame>
      {[20, 34, 48, 62, 76, 90].map((y, i) => (
        <rect key={i} x="20" y={y} width={i % 2 ? 140 : 160} height="4" rx="2" fill="#d4d4d8" />
      ))}
    </Frame>
  );
}
