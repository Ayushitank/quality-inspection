import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createInspectionRouter } from './modules/inspections/inspection.routes.js';
import { createSapRouter } from './modules/integrations/sap.routes.js';

export function createApp({ inspectionService, checkDb, sapWebhookSecret, logRequests = true }) {
  const app = express();

  app.use(helmet());
  if (logRequests) app.use(morgan('tiny'));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await checkDb();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/api/inspections', createInspectionRouter(inspectionService));
  app.use('/api/sap-webhook', createSapRouter({ inspectionService, webhookSecret: sapWebhookSecret }));

  app.use('/api', notFound);
  app.use(errorHandler);

  return app;
}
