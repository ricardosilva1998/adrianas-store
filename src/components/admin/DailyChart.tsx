interface Props {
  data: Array<{ day: string; count: number }>;
}

export default function DailyChart({ data }: Props) {
  const points: Array<{ day: string; count: number }> = [];
  const map = new Map(data.map((d) => [d.day, d.count]));
  const today = new Date();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({ day: key, count: map.get(key) ?? 0 });
  }

  const max = Math.max(1, ...points.map((p) => p.count));
  const height = 140;
  const width = 720;
  const padX = 24;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toX = (i: number) =>
    padX + (innerW * i) / (points.length - 1 || 1);
  const toY = (v: number) => padY + innerH - (innerH * v) / max;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.count).toFixed(1)}`)
    .join(" ");

  const area = `${path} L ${toX(points.length - 1).toFixed(1)} ${(padY + innerH).toFixed(1)} L ${toX(0).toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

  const total = points.reduce((s, p) => s + p.count, 0);

  return (
    <div className="rounded-3xl border border-ink-line bg-white p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rosa-500">
            Últimos 30 dias
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">
            Encomendas por dia
          </h3>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-ink">{total}</p>
          <p className="text-xs text-ink-muted">no período</p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-6 h-36 w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="rosaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F691B4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#F691B4" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1={padX}
            x2={width - padX}
            y1={padY + innerH * r}
            y2={padY + innerH * r}
            stroke="#f4e1e8"
            strokeDasharray="2 4"
          />
        ))}
        <path d={area} fill="url(#rosaGrad)" />
        <path d={path} fill="none" stroke="#ED7396" strokeWidth="2" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={p.day}
            cx={toX(i)}
            cy={toY(p.count)}
            r={p.count > 0 ? 3 : 0}
            fill="#ED7396"
          >
            <title>{`${p.day}: ${p.count}`}</title>
          </circle>
        ))}
      </svg>

      <div className="mt-2 flex justify-between text-[10px] text-ink-muted">
        <span>{points[0]?.day.slice(5)}</span>
        <span>{points[Math.floor(points.length / 2)]?.day.slice(5)}</span>
        <span>Hoje</span>
      </div>
    </div>
  );
}
