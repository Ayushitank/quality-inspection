import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/AppError.js';
import { sapNotificationSchema, toInspectionInput } from './sap.mapper.js';

const digest = (value) => createHash('sha256').update(String(value)).digest();

const requireWebhookSecret = (secret) => (req, _res, next) => {
  const provided = req.get('X-Webhook-Secret') ?? '';
  return timingSafeEqual(digest(provided), digest(secret)) ? next() : next(AppError.unauthorized('Invalid webhook secret'));
};

export function createSapRouter({ inspectionService, webhookSecret }) {
  const router = Router();

  router.post(
    '/',
    requireWebhookSecret(webhookSecret),
    validate({ body: sapNotificationSchema }),
    async (req, res) => {
      const { inspection, created } = await inspectionService.create(toInspectionInput(req.valid.body));
      res.status(created ? 201 : 200).json({ data: inspection });
    },
  );

  return router;
}
