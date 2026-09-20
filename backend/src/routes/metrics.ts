import type { FastifyInstance } from 'fastify';

export async function registerMetricsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/metrics', async () => app.metrics.snapshot());
}