import Frame from "./Frame";
export default function ProductGalleryIllustration() {
  return (
    <Frame>
      <rect x="16" y="14" width="100" height="90" rx="8" fill="#fbcfe8" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="126" y={14 + i * 22} width="58" height="18" rx="4" fill="#f9a8d4" />
      ))}
    </Frame>
  );
}
