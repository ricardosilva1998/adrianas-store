import { db } from "../db/client";
import { sql } from "drizzle-orm";

export type VisitKpi = { pageviews: number; uniques: number };

export type VisitStats = {
  kpis: {
    today: VisitKpi;
    last7: VisitKpi;
    last30: VisitKpi;
  };
  daily30: Array<{ date: string; pageviews: number; uniques: number }>;
  topProducts30: Array<{
    productId: number;
    name: string;
    slug: string;
    views: number;
  }>;
  topPages30: Array<{
    path: string;
    title: string | null;
    views: number;
  }>;
  conversion30: {
    paidOrders: number;
    uniques: number;
    ratePct: number | null;
  };
};

let lastCleanupAt = 0;

async function cleanupOldPageViews(): Promise<void> {
  await db.execute(
    sql`DELETE FROM page_views WHERE viewed_at < now() - interval '90 days'`,
  );
}

function maybeCleanupOldPageViews(): void {
  const now = Date.now();
  if (now - lastCleanupAt > 24 * 60 * 60 * 1000) {
    lastCleanupAt = now;
    void cleanupOldPageViews().catch((err) => {
      console.warn("[cleanup page_views]", err);
      lastCleanupAt = 0;
    });
  }
}

type DbResult<T> = { rows: T[] } | T[];

function rowsOf<T>(result: DbResult<T>): T[] {
  if (Array.isArray(result)) return result;
  return result.rows ?? [];
}

async function kpiForInterval(intervalSql: string): Promise<VisitKpi> {
  const result = (await db.execute(
    sql.raw(
      `SELECT count(*)::int AS pageviews,
              count(DISTINCT visitor_hash)::int AS uniques
         FROM page_views
        WHERE viewed_at >= ${intervalSql}`,
    ),
  )) as DbResult<{ pageviews: number; uniques: number }>;
  const row = rowsOf(result)[0];
  return {
    pageviews: row?.pageviews ?? 0,
    uniques: row?.uniques ?? 0,
  };
}

export async function getVisitStats(): Promise<VisitStats> {
  maybeCleanupOldPageViews();

  const [todayK, last7K, last30K, daily, topProducts, topPages, conv] =
    await Promise.all([
      kpiForInterval(`date_trunc('day', now())`),
      kpiForInterval(`now() - interval '7 days'`),
      kpiForInterval(`now() - interval '30 days'`),

      db.execute(
        sql.raw(
          `SELECT to_char(date_trunc('day', viewed_at), 'YYYY-MM-DD') AS date,
                  count(*)::int AS pageviews,
                  count(DISTINCT visitor_hash)::int AS uniques
             FROM page_views
            WHERE viewed_at >= now() - interval '30 days'
            GROUP BY date_trunc('day', viewed_at)
            ORDER BY date_trunc('day', viewed_at)`,
        ),
      ) as Promise<DbResult<{ date: string; pageviews: number; uniques: number }>>,

      db.execute(
        sql.raw(
          `SELECT p.id AS product_id, p.name, p.slug, count(*)::int AS views
             FROM page_views pv
             JOIN products p ON pv.path = '/catalogo/' || p.slug
            WHERE pv.viewed_at >= now() - interval '30 days'
            GROUP BY p.id, p.name, p.slug
            ORDER BY count(*) DESC
            LIMIT 5`,
        ),
      ) as Promise<DbResult<{ product_id: number; name: string; slug: string; views: number }>>,

      db.execute(
        sql.raw(
          `SELECT pv.path AS path,
                  pg.title AS title,
                  count(*)::int AS views
             FROM page_views pv
             LEFT JOIN pages pg ON pg.slug = ltrim(pv.path, '/')
            WHERE pv.viewed_at >= now() - interval '30 days'
              AND pv.path NOT LIKE '/catalogo/%'
            GROUP BY pv.path, pg.title
            ORDER BY count(*) DESC
            LIMIT 5`,
        ),
      ) as Promise<DbResult<{ path: string; title: string | null; views: number }>>,

      db.execute(
        sql.raw(
          `SELECT
             (SELECT count(*)::int FROM orders
               WHERE status IN ('paid','preparing','shipped','delivered')
                 AND created_at >= now() - interval '30 days') AS paid_orders,
             (SELECT count(DISTINCT visitor_hash)::int FROM page_views
               WHERE viewed_at >= now() - interval '30 days') AS uniques`,
        ),
      ) as Promise<DbResult<{ paid_orders: number; uniques: number }>>,
    ]);

  const dailyRows = rowsOf(daily);
  const productRows = rowsOf(topProducts);
  const pagesRows = rowsOf(topPages);
  const convRow = rowsOf(conv)[0] ?? { paid_orders: 0, uniques: 0 };
  const ratePct =
    convRow.uniques > 0 ? (convRow.paid_orders / convRow.uniques) * 100 : null;

  return {
    kpis: { today: todayK, last7: last7K, last30: last30K },
    daily30: dailyRows.map((r) => ({
      date: r.date,
      pageviews: r.pageviews,
      uniques: r.uniques,
    })),
    topProducts30: productRows.map((r) => ({
      productId: r.product_id,
      name: r.name,
      slug: r.slug,
      views: r.views,
    })),
    topPages30: pagesRows.map((r) => ({
      path: r.path,
      title: r.title,
      views: r.views,
    })),
    conversion30: {
      paidOrders: convRow.paid_orders,
      uniques: convRow.uniques,
      ratePct,
    },
  };
}
