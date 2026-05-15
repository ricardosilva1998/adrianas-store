interface VisitsChartProps {
  data: Array<{ date: string; pageviews: number; uniques: number }>;
}

export default function VisitsChart({ data }: VisitsChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-3xl border border-ink-line bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-rosa-500">
          Últimos 30 dias
        </p>
        <h3 className="mt-1 text-lg font-semibold text-ink">Visitas por dia</h3>
        <p className="mt-6 text-sm text-ink-muted">
          Sem dados ainda — as estatísticas aparecem após as primeiras visitas.
        </p>
      </div>
    );
  }

  const points: Array<{ date: string; pageviews: number; uniques: number }> = [];
  const map = new Map(data.map((d) => [d.date, d]));
  const today = new Date();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = map.get(key);
    points.push({
      date: key,
      pageviews: row?.pageviews ?? 0,
      uniques: row?.uniques ?? 0,
    });
  }

  const totalPv = points.reduce((s, p) => s + p.pageviews, 0);
  const totalUq = points.reduce((s, p) => s + p.uniques, 0);

  const max = Math.max(1, ...points.map((p) => Math.max(p.pageviews, p.uniques)));
  const height = 140;
  const width = 720;
  const padX = 24;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toX = (i: number) => padX + (innerW * i) / (points.length - 1 || 1);
  const toY = (v: number) => padY + innerH - (innerH * v) / max;

  const pvPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.pageviews).toFixed(1)}`)
    .join(" ");
  const uqPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.uniques).toFixed(1)}`)
    .join(" ");

  return (
    <div className="rounded-3xl border border-ink-line bg-surface p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rosa-500">
            Últimos 30 dias
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">Visitas por dia</h3>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-ink">{totalPv}</p>
          <p className="text-xs text-ink-muted">{totalUq} visitantes</p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-6 h-36 w-full"
        preserveAspectRatio="none"
      >
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
        <path d={pvPath} fill="none" stroke="#ED7396" strokeWidth="2" strokeLinecap="round" />
        <path d={uqPath} fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
      </svg>

      <div className="mt-3 flex gap-4 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-1 w-4 rounded-full bg-rosa-500" aria-hidden="true" />
          Pageviews
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-1 w-4 rounded-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg,#1f2937 0 4px,transparent 4px 8px)",
            }}
            aria-hidden="true"
          />
          Visitantes únicos
        </span>
      </div>
    </div>
  );
}
