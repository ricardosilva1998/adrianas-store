import Frame from "./Frame";
export default function CatalogGridBoundIllustration() {
  return (
    <Frame>
      <rect x="16" y="14" width="168" height="10" rx="5" fill="#fbcfe8" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={15 + i * 44} y="32" width="38" height="70" rx="6" fill="#f9a8d4" />
      ))}
    </Frame>
  );
}
