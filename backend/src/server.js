import { createApp } from './app.js';
import { env } from './config/env.js';
import { migrate } from './db/migrate.js';
import { createPool, waitForDb } from './db/pool.js';
import { seedDemoData } from './db/seed.js';
import { createInspectionRepository } from './modules/inspections/inspection.repository.js';
import { createInspectionService } from './modules/inspections/inspection.service.js';

async function main() {
  const pool = createPool(env.DATABASE_URL);
  await waitForDb(pool);
  await migrate(pool);

  const repository = createInspectionRepository(pool);
  if (env.SEED_DEMO_DATA) await seedDemoData(repository);

  const app = createApp({
    inspectionService: createInspectionService(repository),
    checkDb: () => pool.query('SELECT 1'),
    sapWebhookSecret: env.SAP_WEBHOOK_SECRET,
  });

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
