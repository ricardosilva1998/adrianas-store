import Frame from "./Frame";
export default function ImageGalleryIllustration() {
  return (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={15 + (i % 2) * 92} y={15 + Math.floor(i / 2) * 48} width="80" height="40" rx="4" fill="#fbcfe8" />
      ))}
    </Frame>
  );
}
