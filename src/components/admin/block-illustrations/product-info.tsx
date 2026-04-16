import Frame from "./Frame";
export default function ProductInfoIllustration() {
  return (
    <Frame>
      <rect x="20" y="20" width="40" height="4" rx="2" fill="#8a8a8a" />
      <rect x="20" y="32" width="120" height="8" rx="3" fill="#111111" />
      <rect x="20" y="46" width="60" height="6" rx="2" fill="#ED7396" />
      {[62, 72, 82].map((y, i) => (
        <rect key={i} x="20" y={y} width={i === 2 ? 80 : 150} height="4" rx="2" fill="#d4d4d8" />
      ))}
      <rect x="20" y="96" width="80" height="14" rx="7" fill="#ED7396" />
    </Frame>
  );
}
