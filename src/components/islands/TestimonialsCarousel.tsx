import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";

type Item = { name: string; quoteHtml: string; avatarUrl: string };

type Props = {
  items: Item[];
  autoplayMs?: number;
};

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

export default function TestimonialsCarousel({ items, autoplayMs = 7000 }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  const onInit = useCallback(() => {
    if (!emblaApi) return;
    setSnaps(emblaApi.scrollSnapList());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onInit();
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onInit);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onInit);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onInit, onSelect]);

  useEffect(() => {
    if (!emblaApi || isPaused || items.length <= 1) return;
    const id = window.setInterval(() => {
      emblaApi.scrollNext();
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [emblaApi, isPaused, autoplayMs, items.length]);

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

  if (items.length === 0) return null;

  return (
    <div
      className="relative"
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Testemunhos"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="-ml-4 flex md:-ml-6">
          {items.map((item, i) => (
            <div
              key={i}
              className="min-w-0 flex-[0_0_100%] pl-4 md:flex-[0_0_50%] md:pl-6"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${items.length}`}
            >
              <div className="h-full rounded-2xl border border-ink-line bg-white p-6">
                <div
                  className="prose prose-sm max-w-none leading-relaxed text-ink-soft"
                  dangerouslySetInnerHTML={{ __html: item.quoteHtml }}
                />
                <div className="mt-5 flex items-center gap-3">
                  {item.avatarUrl ? (
                    <img
                      src={item.avatarUrl}
                      alt={item.name}
                      className="h-12 w-12 rounded-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rosa-100 text-sm font-semibold text-rosa-600">
                      {initials(item.name)}
                    </div>
                  )}
                  <span className="text-sm font-semibold text-ink">{item.name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={scrollPrev}
            aria-label="Anterior"
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 p-2 text-ink shadow-md ring-1 ring-ink-line transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-rosa-500 sm:-left-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={scrollNext}
            aria-label="Próximo"
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 p-2 text-ink shadow-md ring-1 ring-ink-line transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-rosa-500 sm:-right-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          {snaps.length > 1 && (
            <div className="mt-6 flex justify-center gap-1.5">
              {snaps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollTo(i)}
                  aria-label={`Ir para grupo ${i + 1}`}
                  aria-current={i === selectedIndex}
                  className={`h-1.5 rounded-full transition-all ${
                    i === selectedIndex ? "w-6 bg-rosa-500" : "w-1.5 bg-ink-line"
                  }`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
