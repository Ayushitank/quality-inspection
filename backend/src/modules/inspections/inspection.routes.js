import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import {
  createInspectionBody,
  idParams,
  listInspectionsQuery,
  resolveInspectionBody,
} from './inspection.schema.js';

export function createInspectionRouter(service) {
  const router = Router();

  router.get('/summary', async (_req, res) => {
    res.json({ data: await service.summary() });
  });

  router.get('/', validate({ query: listInspectionsQuery }), async (req, res) => {
    const { items, meta } = await service.list(req.valid.query);
    res.json({ data: items, meta });
  });

  router.post('/', validate({ body: createInspectionBody }), async (req, res) => {
    const { inspection, created } = await service.create(req.valid.body);
    if (created) res.location(`/api/inspections/${inspection.id}`);
    res.status(created ? 201 : 200).json({ data: inspection });
  });

  router.get('/:id', validate({ params: idParams }), async (req, res) => {
    res.json({ data: await service.get(req.valid.params.id) });
  });

  router.post(
    '/:id/resolve',
    validate({ params: idParams, body: resolveInspectionBody }),
    async (req, res) => {
      res.json({ data: await service.resolve(req.valid.params.id, req.valid.body.resolutionNote) });
    },
  );

  return router;
}
