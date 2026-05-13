import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useRef, useState } from "react";

type MediaItem = {
  url: string;
  alt?: string;
  kind?: "image" | "video";
  focalX?: number;
  focalY?: number;
};

type Props = {
  images: MediaItem[];
  productName: string;
  showThumbs?: boolean;
  showBadges?: boolean;
  badges?: { bestseller?: boolean; outOfStock?: boolean };
};

export default function ProductGallery({
  images,
  productName,
  showThumbs = true,
  showBadges = true,
  badges = {},
}: Props) {
  const safeMedia: MediaItem[] =
    images.length > 0
      ? images
      : [{ url: "/placeholders/product.svg", alt: productName, kind: "image" }];

  const focalStyle = (m: MediaItem) => ({
    objectPosition: `${m.focalX ?? 50}% ${m.focalY ?? 50}%`,
  });
  const single = safeMedia.length <= 1;

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start", containScroll: "trimSnaps" });
  const [thumbsRef, thumbsApi] = useEmblaCarousel({ containScroll: "keepSnaps", dragFree: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const idx = emblaApi.selectedScrollSnap();
    setSelectedIndex(idx);
    thumbsApi?.scrollTo(idx);
  }, [emblaApi, thumbsApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (idx === selectedIndex) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [selectedIndex]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((idx: number) => emblaApi?.scrollTo(idx), [emblaApi]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollNext();
      }
    },
    [scrollPrev, scrollNext],
  );

  if (single) {
    const media = safeMedia[0]!;
    return (
      <div className="flex flex-col gap-4">
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-ink-line bg-rosa-50">
          {media.kind === "video" ? (
            <video
              ref={(el) => {
                if (el) videoRefs.current.set(0, el);
                else videoRefs.current.delete(0);
              }}
              src={media.url}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
              aria-label={media.alt || productName}
            />
          ) : (
            <img
              src={media.url}
              alt={media.alt || productName}
              className="h-full w-full object-cover"
              style={focalStyle(media)}
            />
          )}
          {showBadges && <Badges {...badges} />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative"
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`Galeria de imagens de ${productName}`}
        onKeyDown={onKeyDown}
      >
        <div className="overflow-hidden rounded-3xl border border-ink-line bg-rosa-50" ref={emblaRef}>
          <div className="flex">
            {safeMedia.map((media, i) => (
              <div
                key={i}
                className="relative aspect-square w-full flex-[0_0_100%]"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} de ${safeMedia.length}`}
              >
                {media.kind === "video" ? (
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(i, el);
                      else videoRefs.current.delete(i);
                    }}
                    src={media.url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="h-full w-full object-cover"
                    aria-label={media.alt || productName}
                  />
                ) : (
                  <img
                    src={media.url}
                    alt={media.alt || productName}
                    className="h-full w-full object-cover"
                    style={focalStyle(media)}
                    draggable={false}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {showBadges && (
          <div className="pointer-events-none absolute inset-0">
            <Badges {...badges} />
          </div>
        )}

        <button
          type="button"
          onClick={scrollPrev}
          aria-label="Imagem anterior"
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink shadow-md ring-1 ring-ink-line transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-rosa-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={scrollNext}
          aria-label="Próxima imagem"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink shadow-md ring-1 ring-ink-line transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-rosa-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {safeMedia.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Ir para imagem ${i + 1}`}
              aria-current={i === selectedIndex}
              className={`h-1.5 rounded-full transition-all ${
                i === selectedIndex ? "w-6 bg-ink" : "w-1.5 bg-white/80"
              }`}
            />
          ))}
        </div>
      </div>

      {showThumbs && (
        <div className="overflow-hidden" ref={thumbsRef}>
          <div className="flex gap-3">
            {safeMedia.map((media, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`Imagem ${i + 1}`}
                aria-current={i === selectedIndex}
                className={`aspect-square w-20 shrink-0 overflow-hidden rounded-xl border bg-rosa-50 transition ${
                  i === selectedIndex
                    ? "border-rosa-400 ring-2 ring-rosa-400"
                    : "border-ink-line hover:border-rosa-300"
                }`}
              >
                {media.kind === "video" ? (
                  <div className="relative h-full w-full">
                    <video
                      src={media.url}
                      preload="metadata"
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-6 w-6 drop-shadow">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </div>
                ) : (
                  <img
                    src={media.url}
                    alt={media.alt || productName}
                    className="h-full w-full object-cover"
                    style={focalStyle(media)}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Badges({
  bestseller,
  outOfStock,
}: {
  bestseller?: boolean;
  outOfStock?: boolean;
}) {
  return (
    <>
      {bestseller && (
        <span className="pointer-events-none absolute left-5 top-5 inline-flex items-center rounded-full bg-rosa-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          Mais vendido
        </span>
      )}
      {outOfStock && (
        <span className="pointer-events-none absolute right-5 top-5 inline-flex items-center rounded-full bg-ink px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          Esgotado
        </span>
      )}
    </>
  );
}
