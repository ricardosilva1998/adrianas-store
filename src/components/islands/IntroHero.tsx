import { useEffect, useState } from "react";

type Props = {
  title: string;
  titleAccent?: string;
  subtitleHtml?: string;
  buttonText?: string;
  buttonUrl?: string;
  imageUrl?: string;
  overlayOpacity?: number;
  height?: "medium" | "tall" | "full";
};

export default function IntroHero({
  title,
  titleAccent,
  subtitleHtml,
  buttonText,
  buttonUrl,
  imageUrl,
  overlayOpacity = 40,
}: Props) {
  const [opacity, setOpacity] = useState(1);
  const [translateY, setTranslateY] = useState(0);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sc = window.scrollY;
        const h = window.innerHeight;
        const ratio = Math.min(sc / h, 1);
        setOpacity(Math.max(0, 1 - ratio * 1.2));
        setTranslateY(ratio * -60);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const overlay = Math.max(0, Math.min(80, overlayOpacity)) / 100;

  return (
    <section
      className="relative mx-auto w-full max-w-[843px] overflow-hidden bg-ink"
      style={{
        aspectRatio: "843 / 300",
        opacity,
        transform: `translate3d(0, ${translateY}px, 0)`,
        willChange: "opacity, transform",
      }}
      aria-hidden={opacity < 0.05}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden
        />
      )}
      {imageUrl && overlay > 0 && (
        <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} aria-hidden />
      )}
      <div className="relative mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6 text-center text-white sm:px-10 lg:px-16">
        {(title || titleAccent) && (
          <h1 className="text-4xl font-semibold leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] sm:text-5xl lg:text-6xl">
            {title && <span>{title}</span>}
            {title && titleAccent && <br />}
            {titleAccent && <span className="text-rosa-300">{titleAccent}</span>}
          </h1>
        )}
        {subtitleHtml && (
          <div
            className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)] sm:text-lg"
            dangerouslySetInnerHTML={{ __html: subtitleHtml }}
          />
        )}
        {buttonText && buttonUrl && (
          <div className="mt-10">
            <a href={buttonUrl} className="btn-primary">
              {buttonText}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
