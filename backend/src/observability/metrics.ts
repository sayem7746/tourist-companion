const LATENCY_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] as const;
const SAMPLE_CAP = 2000;

export type RouteStats = {
  count: number;
  errors: number;
  latencyMs: {
    max: number;
    p50: number | null;
    p95: number | null;
    p99: number | null;
  };
};

export type MetricsSnapshot = {
  startedAt: string;
  uptimeSeconds: number;
  requestsTotal: number;
  errorsTotal: number;
  latencyMs: {
    max: number;
    p50: number | null;
    p95: number | null;
    p99: number | null;
    histogram: { le: number | '+Inf'; count: number }[];
  };
  byRoute: Record<string, RouteStats>;
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? null;
}

function routeKey(method: string, url: string): string {
  const path = url.split('?')[0] ?? url;
  return `${method.toUpperCase()} ${path}`;
}

export function createMetricsCollector(startedAt = new Date()) {
  const byRoute = new Map<
    string,
    { count: number; errors: number; maxMs: number; samples: number[] }
  >();
  const histogram = LATENCY_BUCKETS_MS.map(() => 0);
  let infBucket = 0;
  const globalSamples: number[] = [];
  let requestsTotal = 0;
  let errorsTotal = 0;
  let maxMs = 0;

  function record(method: string, url: string, statusCode: number, durationMs: number): void {
    if (url.startsWith('/metrics')) {
      return;
    }

    const ms = Math.max(0, durationMs);
    requestsTotal += 1;
    const isError = statusCode >= 400;
    if (isError) {
      errorsTotal += 1;
    }
    if (ms > maxMs) {
      maxMs = ms;
    }

    const bucketIndex = LATENCY_BUCKETS_MS.findIndex((bound) => ms <= bound);
    if (bucketIndex === -1) {
      infBucket += 1;
    } else {
      histogram[bucketIndex] += 1;
    }

    if (globalSamples.length >= SAMPLE_CAP) {
      globalSamples.shift();
    }
    globalSamples.push(ms);

    const key = routeKey(method, url);
    const current = byRoute.get(key) ?? { count: 0, errors: 0, maxMs: 0, samples: [] };
    current.count += 1;
    if (isError) {
      current.errors += 1;
    }
    if (ms > current.maxMs) {
      current.maxMs = ms;
    }
    if (current.samples.length >= SAMPLE_CAP) {
      current.samples.shift();
    }
    current.samples.push(ms);
    byRoute.set(key, current);
  }

  function snapshot(): MetricsSnapshot {
    const sortedGlobal = [...globalSamples].sort((a, b) => a - b);
    const byRouteSnapshot: Record<string, RouteStats> = {};
    for (const [key, value] of byRoute.entries()) {
      const sorted = [...value.samples].sort((a, b) => a - b);
      byRouteSnapshot[key] = {
        count: value.count,
        errors: value.errors,
        latencyMs: {
          max: value.maxMs,
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
          p99: percentile(sorted, 99),
        },
      };
    }

    let cumulative = 0;
    const histogramRows: { le: number | '+Inf'; count: number }[] = LATENCY_BUCKETS_MS.map(
      (le, index) => {
        cumulative += histogram[index] ?? 0;
        return { le, count: cumulative };
      },
    );
    histogramRows.push({ le: '+Inf', count: cumulative + infBucket });

    return {
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      requestsTotal,
      errorsTotal,
      latencyMs: {
        max: maxMs,
        p50: percentile(sortedGlobal, 50),
        p95: percentile(sortedGlobal, 95),
        p99: percentile(sortedGlobal, 99),
        histogram: histogramRows,
      },
      byRoute: byRouteSnapshot,
    };
  }

  return { record, snapshot };
}

export type MetricsCollector = ReturnType<typeof createMetricsCollector>;

declare module 'fastify' {
  interface FastifyInstance {
    metrics: MetricsCollector;
  }
}
