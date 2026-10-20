import { PAGE_SIZE } from '../lib/constants.js';
import { request } from './http.js';

export const listInspections = (filters, page) =>
  request('/api/inspections', { query: { ...filters, page, pageSize: PAGE_SIZE } });

export const getSummary = async () => (await request('/api/inspections/summary')).data;

export const createInspection = async (payload) => (await request('/api/inspections', { method: 'POST', body: payload })).data;

export const resolveInspection = async (id, resolutionNote) =>
  (await request(`/api/inspections/${id}/resolve`, { method: 'POST', body: { resolutionNote } })).data;
