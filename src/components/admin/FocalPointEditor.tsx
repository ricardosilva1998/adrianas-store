import { useCallback, useRef, useState } from "react";
import { clampFocal, focalFromDrag, type FocalPoint } from "../../lib/focal-point";

interface Props {
  imageUrl: string;
  /** Numeric aspect ratio of the destination crop, e.g. 843/300, 1, 4/5. */
  aspectRatio: number;
  /** Current focal point (0-100). Undefined → 50/50. */
  focal?: FocalPoint;
  onChange: (focal: FocalPoint) => void;
  /** Optional label shown above the preview. */
  label?: string;
}

/**
 * Drag-the-image focal-point editor.
 *
 * Renders the image at `object-fit: cover` inside a crop preview of the
 * destination aspect ratio. Drag inside the preview to reposition the visible
 * portion of the image. The pixel deltas are converted to focal point % via
 * `focalFromDrag` so the math matches the storefront renderer.
 */
export default function FocalPointEditor({
  imageUrl,
  aspectRatio,
  focal,
  onChange,
  label,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const f = clampFocal(focal ?? { x: 50, y: 50 });

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageNatural({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!imageNatural || !containerRef.current) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const containerW = rect.width;
      const containerH = rect.height;
      let lastX = e.clientX;
      let lastY = e.clientY;
      let current = f;
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - lastX;
        const dy = ev.clientY - lastY;
        lastX = ev.clientX;
        lastY = ev.clientY;
        current = focalFromDrag({
          containerW,
          containerH,
          imageW: imageNatural.w,
          imageH: imageNatural.h,
          current,
          deltaPxX: dx,
          deltaPxY: dy,
        });
        onChange(current);
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [imageNatural, f.x, f.y, onChange],
  );

  // Keyboard nudges (arrows = 2%, shift+arrow = 10%) for accessibility.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    e.preventDefault();
    onChange(clampFocal({ x: f.x + dx, y: f.y + dy }));
  };

  if (!imageUrl) return null;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-medium uppercase tracking-wide text-ink-muted">
          {label}
        </label>
      )}
      <div
        ref={containerRef}
        role="slider"
        tabIndex={0}
        aria-label="Ajustar enquadramento da imagem (arrastar ou setas do teclado)"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`x ${Math.round(f.x)}% · y ${Math.round(f.y)}%`}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className={`relative w-full overflow-hidden rounded-2xl border border-ink-line bg-ink-line/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rosa-400 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ aspectRatio: String(aspectRatio) }}
      >
        <img
          src={imageUrl}
          alt=""
          onLoad={handleImageLoad}
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
          style={{ objectFit: "cover", objectPosition: `${f.x}% ${f.y}%` }}
        />
        {/* Subtle crosshair marker showing the current focal point */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
          style={{ left: `${f.x}%`, top: `${f.y}%` }}
        />
      </div>
      <p className="text-[11px] text-ink-muted">
        Arrasta a imagem para escolher o que aparece. ({Math.round(f.x)}% · {Math.round(f.y)}%)
        <button
          type="button"
          onClick={() => onChange({ x: 50, y: 50 })}
          className="ml-2 underline hover:text-rosa-500"
        >
          repor centro
        </button>
      </p>
    </div>
  );
}
